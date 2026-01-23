import { KafkaHelper } from './kafka.helper';
import { PrismaClient, Transaction } from '@prisma/client';
import KafkaDiagnostic from './kafka-diagnostic';
import TransactionRepository from '../../repository/transactions';

// Configuration et initialisation
const kafkaConfig: KafkaConfig = {
  clientId: process.env.KAFKA_CLIENT_ID || 'test-app',
  brokers: (process.env.KAFKA_BROKERS || '10.10.140.110:9092').split(',')
};

// Interfaces pour améliorer la testabilité et la maintenabilité
interface KafkaConfig {
  clientId: string;
  brokers: string[];
}

interface RetourReglement {
  Name: string;
  CodePrestataire: string;
  CodeTraitement: number;
  MessageTraitement: string;
  ReferenceContratClient: string;
  ReferenceDeTransaction: string;
  TypeTansaction: string;
  MontantReglement: string;
  NumeroRecu: string;
  NumeroDeFacture: string;
  CodeAgregateur: string;
  Periode: string | null;
}

interface Payment {
  Date_Reglement: string;
  Heure_Reglement: string;
  Montant_reglement: number;
  Numero_recu: string;
  Prestatire: string;
  Num_Transaction: string;
  Type_Operation: string;
  Type_Canal: string;
  OrigineSaphir: string;
  Ref_Facture: string;
}

interface KafkaMessage {
  RetourReglement: RetourReglement;
  Payment: Payment;
  Datejour: string;
  VerionSaphir: string;
  DateReception: string;
}

interface DatabaseService {
  findTransaction: (numeroRecu: string) => Promise<any>;
  createTransaction: (data: any) => Promise<any>;
  findCodeSociety: (criteria: any) => Promise<any>;
  findSociety: (criteria: any) => Promise<any>;
}

// Classe pour gérer les transactions
export class TransactionProcessor {
  private dbService: DatabaseService;
  private kafkaHelper: KafkaHelper;

  constructor(dbService: DatabaseService, kafkaHelper: KafkaHelper) {
    this.dbService = dbService;
    this.kafkaHelper = kafkaHelper;
  }

  async getOperateurId(operateurCode: string): Promise<string> {
    const codeSociety = await this.dbService.findCodeSociety({
      code: operateurCode,
      // select: { idPartner: true }
    });
    if (!codeSociety) {
      throw new Error(`Operateur not found: ${operateurCode}`);
    }
    return codeSociety.idPartner;
  }

  async getSocietyId(societyCode: string): Promise<string> {
    const society = await this.dbService.findSociety({
      codeSociety: societyCode
    });
    if (!society) throw new Error(`Society not found: ${societyCode}`);
    return society.id;
  }

  async getCodeSocietyId(societyCode: string, partnerCode: string): Promise<string> {
    const codeSociety = await this.dbService.findCodeSociety({ code: partnerCode, society: { codeSociety: societyCode } });
    if (!codeSociety) {
      throw new Error(`CodeSociety not found: ${societyCode} - ${partnerCode}`);
    }
    return codeSociety.id;
  }

  async processTransaction(message: { value: string; }): Promise<void> {
    console.log('Processing transaction:', message);
    try {
      const kafkaMessage: KafkaMessage = JSON.parse(message.value);
      console.log('Message parsé:', kafkaMessage);

      const existingTransaction = await this.dbService.findTransaction(kafkaMessage.RetourReglement.NumeroRecu);
      if (existingTransaction) {
        console.log(`Transaction already exists: ${kafkaMessage.RetourReglement.NumeroRecu}. Skipping.`);
        return;
      }

      const transaction: any = {
        canal: kafkaMessage.Payment.Type_Canal,
        referenceClient: kafkaMessage.RetourReglement.Name,
        referenceContrat: kafkaMessage.RetourReglement.ReferenceContratClient,
        facture: kafkaMessage.RetourReglement.NumeroDeFacture,
        numeroRecu: kafkaMessage.RetourReglement.NumeroRecu,
        operateurId: await this.getOperateurId(kafkaMessage.RetourReglement.CodePrestataire),
        statutOperations: kafkaMessage.RetourReglement.MessageTraitement,
        details: JSON.stringify(kafkaMessage),
        source: kafkaMessage.Payment.OrigineSaphir,
        dateDePaiement: new Date(`${kafkaMessage.Payment.Date_Reglement.slice(0, 4)}-${kafkaMessage.Payment.Date_Reglement.slice(4, 6)}-${kafkaMessage.Payment.Date_Reglement.slice(6, 8)}`),
        dateFlux: new Date(parseInt(kafkaMessage.Datejour.replace('/Date(', '').replace(')/', ''))),
        montant: kafkaMessage.Payment.Montant_reglement,
        societyId: await this.getSocietyId('SODECI'),
        codeSocietyId: await this.getCodeSocietyId(
          'SODECI',
          kafkaMessage.RetourReglement.CodePrestataire
        ),
      };

      await this.dbService.createTransaction(transaction);
      console.log(`Transaction importée: ${transaction.numeroRecu}`);
    } catch (error) {
      console.error('Erreur lors du traitement de la transaction:', error);
      throw error;
    }
  }
}

// Implémentation concrète du DatabaseService avec Prisma
export class PrismaDbService implements DatabaseService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async findTransaction(numeroRecu: string) {
    return this.prisma.transaction.findFirst({
      where: { numeroRecu }
    });
  }

  async createTransaction(data: any) {
    return this.prisma.transaction.create({ data });
  }

  async findCodeSociety(criteria: any) {
    // this.prisma.codeSociety.findFirst({where: {}})
    return this.prisma.codeSociety.findFirst({ where: criteria });
  }

  async findSociety(criteria: any) {
    return this.prisma.society.findFirst({ where: criteria });
  }
}

export async function initKafkaConsumer() {
  const dbService = new PrismaDbService();
  const kafkaHelper = new KafkaHelper(kafkaConfig);
  const transactionProcessor = new TransactionProcessor(dbService, kafkaHelper);

  try {
    await kafkaHelper.initConsumer('test-agpay');
    await kafkaHelper.subscribe('SODECI-NMPF-REGLEMENTS', async (message: any) => {
      console.log('Message reçu:', {
        topic: message.topic,
        partition: message.partition,
        offset: message.offset,
        timestamp: message.timestamp
      });
      console.log(message.value.toString());

      await transactionProcessor.processTransaction(message);
    });

    console.log('Consumer Kafka initialisé avec succès');
  } catch (error) {
    console.error('Erreur lors de l\'initialisation du consumer Kafka:', error);
    throw error;
  }
}

async function checkKafkaBeforeConnect() {
  const diagnostic = new KafkaDiagnostic(kafkaConfig.brokers, kafkaConfig.clientId);

  // Vérifier la connectivité
  const connectivity = await diagnostic.checkBrokerConnectivity();
  const allBrokersAccessible = connectivity.every(result => result.accessible);

  if (!allBrokersAccessible) {
    throw new Error('Certains brokers Kafka ne sont pas accessibles');
  }

  // Vérifier les permissions
  const permissions = await diagnostic.checkConsumerGroupPermissions('transactions-group');
  if (!permissions.hasPermissions) {
    throw new Error(`Problème de permissions: ${permissions.error}`);
  }
}


