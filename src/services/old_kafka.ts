import { KafkaHelper } from '../helpers/kafka/kafka.helper';
import { KafkaDiagnostic } from '../helpers/kafka/kafka-diagnostic';
import { PrismaDbService } from '../helpers/kafka/kafka.event';
import PartnerRepository from '../repository/partners';
// import CodeSocietyRepository from '../repository/c'
class KafkaService {
  private kafkaHelper: KafkaHelper;
  private kafkaDiagnostic: KafkaDiagnostic;
  private dbService: PrismaDbService;
  private isConnected: boolean = false;

  constructor() {
    const kafkaConfig = {
      clientId: process.env.KAFKA_CLIENT_ID || 'agpaiems-app',
      brokers: (process.env.KAFKA_BROKERS || '10.10.140.110:9092').split(',')
    };

    this.kafkaHelper = new KafkaHelper(kafkaConfig);
    this.kafkaDiagnostic = new KafkaDiagnostic(kafkaConfig.brokers, kafkaConfig.clientId);
    this.dbService = new PrismaDbService();
  }
  private partnerRepository = new PartnerRepository();
  // private codeSociety = new CodeSocietyRepository();
  /**
   * Initialise la connexion au broker Kafka
   * @param groupId - Identifiant du groupe de consommateurs
   * @returns Promise<void>
   */
  async connect(groupId: string): Promise<void> {
    try {
      // Vérifier la connectivité avant de se connecter
      const diagnosticResults = await this.checkConnectivity();
      const hasAccessibleBroker = diagnosticResults.some(result => result.accessible);

      if (!hasAccessibleBroker) {
        throw new Error('Aucun broker Kafka accessible');
      }

      await this.kafkaHelper.initConsumer(groupId);
      this.isConnected = true;
      console.log('Connecté au broker Kafka avec succès');
    } catch (error) {
      console.error('Erreur lors de la connexion au broker Kafka:', error);
      throw error;
    }
  }

  /**
   * Vérifie la connectivité aux brokers Kafka
   * @returns Promise<BrokerCheck[]>
   */
  async checkConnectivity() {
    try {
      return await this.kafkaDiagnostic.checkBrokerConnectivity();
    } catch (error) {
      console.error('Erreur lors de la vérification de la connectivité:', error);
      throw error;
    }
  }

  /**
   * S'abonne à un topic et commence à traiter les messages
   * @param topic - Nom du topic
   * @returns Promise<void>
   */
  async subscribe(topic: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Non connecté au broker Kafka');
    }

    try {
      await this.kafkaHelper.subscribe(topic, async (message: any) => {
        try {
          // Log raw message
          console.log(`[Kafka] Received message from topic ${topic}:`, {
            partition: message.partition,
            offset: message.offset,
            timestamp: message.timestamp,
            size: message.value?.length || 0
          });

          // Traiter le message
          const messageValue = JSON.parse(message.value);

          // Vérifier si c'est un message de retour de règlement
          if (messageValue.RetourReglement) {
            console.log('[Kafka] Processing payment return:', {
              receiptNumber: messageValue.RetourReglement.NumeroRecu,
              amount: messageValue.RetourReglement.MontantReglement,
              transactionRef: messageValue.RetourReglement.ReferenceDeTransaction,
              type: messageValue.RetourReglement.TypeTansaction
            });

            const transaction = await this.dbService.findTransaction(
              messageValue.RetourReglement.NumeroRecu
            );

            if (!transaction) {
              console.log('[Kafka] Creating new transaction for receipt:', messageValue.RetourReglement.NumeroRecu);
              console.log('Data : ', messageValue);
              // Créer une nouvelle transaction

              const codePartenaire = messageValue.RetourReglement.CodePrestataire;
              const partner = await this.partnerRepository.getByCode(codePartenaire);
              // const cs = await this.codeSociety.getByCode(codePartenaire);
              await this.dbService.createTransaction({
                referenceClient: messageValue.RetourReglement.Name,
                referenceContrat: messageValue.RetourReglement.ReferenceContratClient,
                referenceTransaction: messageValue.RetourReglement.ReferenceDeTransaction,
                facture: messageValue.RetourReglement.NumeroDeFacture,
                numeroRecu: messageValue.RetourReglement.NumeroRecu,
                montant: parseFloat(messageValue.RetourReglement.MontantReglement),
                source: messageValue.Payment.OrigineSaphir,
                operateurId: await this.getOperateurId(messageValue.RetourReglement.CodePrestataire),
                statutOperations: messageValue.RetourReglement.MessageTraitement,
                details: JSON.stringify(messageValue),
                dateDePaiement: new Date(),//new Date(`${(messageValue.Payment.Date_Reglement as String).slice(0, 2)}-${messageValue.Payment.Date_Reglement.slice(2, 4)}-${messageValue.Payment.Date_Reglement.slice(4, 8)}`),
                dateFlux: new Date(parseInt(messageValue.Datejour.replace('/Date(', '').replace(')/', ''))),
                societyId: await this.getSocietyId('SODECI'),
                codeSocietyId: await this.getCodeSocietyId(
                  messageValue.RetourReglement.CodePrestataire,
                  // messageValue.RetourReglement.CodePrestataire
                ),
                canal: messageValue.Payment.Type_Canal,
              });
              console.log('[Kafka] Transaction created successfully');
            } else {
              console.log('[Kafka] Transaction already exists for receipt:', messageValue.RetourReglement.NumeroRecu);
            }
          }

          console.log(`[Kafka] Successfully processed message from topic ${topic}:`, {
            offset: message.offset,
            timestamp: message.timestamp
          });
        } catch (error: any) {
          console.error('[Kafka] Error processing message:', {
            error: error,
            topic,
            offset: message.offset,
            timestamp: message.timestamp
          });
        }
      });

      console.log(`Abonné au topic: ${topic}`);
    } catch (error) {
      console.error('Erreur lors de l\'abonnement au topic:', error);
      throw error;
    }
  }

  /**
   * S'abonne à plusieurs topics et commence à traiter les messages
   * @param topics - Liste des noms de topics
   * @returns Promise<void>
   */
  async subscribeToMultipleTopics(topics: string[]): Promise<string> {
    if (!this.isConnected) {
      throw new Error('Non connecté au broker Kafka');
    }

    try {
      await this.kafkaHelper.subscribeToMultipleTopics(topics, async (message: any, topic: string) => {
        try {
          // Log raw message
          console.log(`[Kafka] Received message from topic ${topic}:`, {
            partition: message.partition,
            offset: message.offset,
            timestamp: message.timestamp,
            size: message.value?.length || 0
          });

          let res = topic.split("-");
          const name = res[0];

          // Traiter le message
          const messageValue = JSON.parse(message.value);

          // Vérifier si c'est un message de retour de règlement
          if (messageValue.RetourReglement) {
            console.log('[Kafka] Processing payment return:', {
              receiptNumber: messageValue.RetourReglement.NumeroRecu,
              amount: messageValue.RetourReglement.MontantReglement,
              transactionRef: messageValue.RetourReglement.ReferenceDeTransaction,
              type: messageValue.RetourReglement.TypeTansaction
            });

            const transaction = await this.dbService.findTransaction(
              messageValue.RetourReglement.NumeroRecu
            );

            if (!transaction) {
              console.log('[Kafka] Creating new transaction for receipt:', messageValue.RetourReglement.NumeroRecu);
              console.log('Data : ', messageValue);
              // Créer une nouvelle transaction

              const codePartenaire = messageValue.RetourReglement.CodePrestataire;
              const partner = await this.partnerRepository.getByCode(codePartenaire);
              // const cs = await this.codeSociety.getByCode(codePartenaire);
              await this.dbService.createTransaction({
                referenceClient: messageValue.RetourReglement.Name,
                referenceContrat: messageValue.RetourReglement.ReferenceContratClient,
                referenceTransaction: messageValue.RetourReglement.ReferenceDeTransaction,
                facture: messageValue.RetourReglement.NumeroDeFacture,
                numeroRecu: messageValue.RetourReglement.NumeroRecu,
                montant: parseFloat(messageValue.RetourReglement.MontantReglement),
                source: messageValue.Payment.OrigineSaphir,
                operateurId: await this.getOperateurId(messageValue.RetourReglement.CodePrestataire),
                statutOperations: messageValue.RetourReglement.MessageTraitement,
                details: JSON.stringify(messageValue),
                dateDePaiement: new Date(),//new Date(`${(messageValue.Payment.Date_Reglement as String).slice(0, 2)}-${messageValue.Payment.Date_Reglement.slice(2, 4)}-${messageValue.Payment.Date_Reglement.slice(4, 8)}`),
                dateFlux: new Date(parseInt(messageValue.Datejour.replace('/Date(', '').replace(')/', ''))),
                societyId: await this.getSocietyId(name),
                codeSocietyId: await this.getCodeSocietyId(
                  messageValue.RetourReglement.CodePrestataire,
                  // messageValue.RetourReglement.CodePrestataire
                ),
                canal: messageValue.Payment.Type_Canal,
              });
              console.log('[Kafka] Transaction created successfully');
            } else {
              console.log('[Kafka] Transaction already exists for receipt:', messageValue.RetourReglement.NumeroRecu);
            }
          }

          console.log(`[Kafka] Successfully processed message from topic ${topic}:`, {
            offset: message.offset,
            timestamp: message.timestamp
          });
        } catch (error: any) {
          console.error('[Kafka] Error processing message:', {
            error: error,
            topic,
            offset: message.offset,
            timestamp: message.timestamp
          });
        }
      });
      return `Abonné aux topics: ${topics.join(', ')}`;
    } catch (error: any) {
      console.error('Erreur lors de l\'abonnement aux topics:', error);
      throw error;
    }
  }

  async getSocietyId(societyCode: string): Promise<string> {
    const society = await this.dbService.findSociety({
      codeSociety: societyCode
    });
    if (!society) throw new Error(`Society not found: ${societyCode}`);
    return society.id;
  }

  async getCodeSocietyId(partnerCode: string): Promise<string> {
    const codeSociety = await this.dbService.findCodeSociety({
      code: partnerCode,
      // society: { codeSociety: societyCode }
    });
    if (!codeSociety) {
      throw new Error(`CodeSociety not found: ${partnerCode}`);
    }
    return codeSociety.id;
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

  /**
   * Déconnecte le consumer Kafka
   * @returns Promise<void>
   */
  async disconnect(): Promise<void> {
    try {
      await this.kafkaHelper.disconnect();
      this.isConnected = false;
      console.log('Déconnecté du broker Kafka avec succès');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      throw error;
    }
  }

  /**
   * Vérifie si le service est connecté au broker Kafka
   * @returns boolean
   */
  isKafkaConnected(): boolean {
    return this.isConnected;
  }
}

// Export d'une instance unique du service
// export default new KafkaService();