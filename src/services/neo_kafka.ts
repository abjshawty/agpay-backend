import { Kafka, Producer, Consumer } from "kafkajs";
import TransactionRepository from "../repository/transactions";
import { PrismaClient } from "@prisma/client";

const broker = process.env.KAFKA_BROKERS || '10.10.140.110:9092';
const clientId = process.env.KAFKA_CLIENT_ID || 'agpaiems-app';
const groupId = process.env.KAFKA_GROUP_ID || 'watcher-service';
const topics = ["CIE-NMPF-REGLEMENTS", "SODECI-NMPF-REGLEMENTS"];
const prisma = new PrismaClient();
async function getCodeSocietyId (partnerCode: string): Promise<string> {
    const codeSociety = await prisma.codeSociety.findFirst({
        where: {
            code: partnerCode.toUpperCase(),
        }
    });
    if (!codeSociety) {
        throw new Error(`CodeSociety not found: ${partnerCode}`);
    }
    return codeSociety.id;
}
async function getOperateurId (operateurCode: string): Promise<string> {
    const codeSociety = await prisma.codeSociety.findFirst({
        where: {
            code: operateurCode.toUpperCase(),
        }
    });
    if (!codeSociety) {
        throw new Error(`Operateur not found: ${operateurCode}`);
    }
    return codeSociety.idPartner;
}
async function getSocietyId (societyCode: string): Promise<string> {
    const society = await prisma.society.findFirst({
        where: {
            codeSociety: societyCode.toUpperCase(),
        }
    });
    if (!society) throw new Error(`Society not found: ${societyCode}`);
    return society.id;
}

class KafkaMaker {
    private repo: TransactionRepository;
    private broker: string;
    private conditions: { producer: boolean, consumer: boolean; };
    private clientId: string;
    private kafka: Kafka;
    private producer: Producer;
    private consumer: Consumer;
    private topics: string[];
    constructor (broker: string, clientId: string, topics: string[]) {
        this.repo = new TransactionRepository();
        this.broker = broker;
        this.conditions = { producer: false, consumer: false };
        this.clientId = clientId;
        this.kafka = new Kafka({
            clientId: this.clientId,
            brokers: [this.broker],
        });
        this.producer = this.kafka.producer();
        this.consumer = this.kafka.consumer({ groupId: groupId });
        this.topics = topics;
    }
    public async consume () {
        for (const topic of this.topics) {
            await this.consumer.subscribe({
                topic,
                fromBeginning: true,
            }).then(() => {
                console.log(`Subscribed to topic: ${topic}`);
            }).catch((error) => {
                console.error(error, `Failed to subscribe to topic: ${topic}`);
            });
        }
        await this.consumer.connect();
        this.conditions.consumer = true;
        let counter = 0;
        const transform = async (record: Record<string, any>, topic_: string) => {
            try {
                const name = topic_.split("-")[0];
                const final_form = {
                    canal: record.Payment.Type_Canal,
                    dateDePaiement: new Date(`${(record.Payment.Date_Reglement as String).slice(4, 8)}-${record.Payment.Date_Reglement.slice(2, 4)}-${record.Payment.Date_Reglement.slice(0, 2)}T${record.Payment.Heure_Reglement.slice(0, 2)}:${record.Payment.Heure_Reglement.slice(2, 4)}:${record.Payment.Heure_Reglement.slice(4, 6)}.000Z`),
                    dateFlux: new Date(),
                    // dateDePaiement: new Date(parseInt(record.Datejour.replace('/Date(', '').replace(')/', ''))),
                    details: JSON.stringify(record),
                    facture: record.RetourReglement.NumeroDeFacture || "",
                    montant: parseFloat(record.RetourReglement.MontantReglement),
                    numeroRecu: record.RetourReglement.NumeroRecu,
                    referenceClient: record.RetourReglement.Name,
                    referenceContrat: record.RetourReglement.ReferenceContratClient,
                    referenceTransaction: record.RetourReglement.ReferenceDeTransaction,
                    source: record.Payment.OrigineSaphir.toUpperCase(),
                    statutOperations: record.RetourReglement.MessageTraitement,

                    codeSocietyId: await getCodeSocietyId(
                        record.RetourReglement.CodePrestataire,
                    ),
                    operateurId: await getOperateurId(record.RetourReglement.CodePrestataire),
                    societyId: await getSocietyId(name),
                };
                return final_form;
            } catch (error) {
                console.error(error, "Error in transform");
            }
        };

        await this.consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                const service = (topic.charAt(0).toUpperCase() + topic.slice(1)).slice(0, -1);
                counter++;
                console.log(`Service: ${service}`);
                try {
                    if (service === 'CIE-NMPF-REGLEMENT') {
                        const record = JSON.parse(message.value!.toString());
                        console.log(`Record ${counter}:`, record);
                        if (!record.hasOwnProperty("Payment")) {
                            console.log("made via agpay");
                            await this.repo.add(record);
                        } else {
                            await this.repo.add(await transform(record, topic));
                        }

                    } else if (service === 'SODECI-NMPF-REGLEMENT') {
                        const record = JSON.parse(message.value!.toString());
                        console.log(`Record ${counter}:`, record);
                        if (!record.Payment.Type_Canal) {
                            console.log("made via agpay");
                            await this.repo.add(record);
                        } else {
                            await this.repo.add(await transform(record, topic));
                        }
                    }
                } catch (error: any) {
                    console.error("KAFKA error (neo_kafka service):   ", error);
                }
            },
        });
    }
    public async produce () {
        await this.producer.connect();
        this.conditions.producer = true;
    }
    public async send (record: Record<string, any>, topic: string) {
        await this.producer.send({
            topic,
            messages: [{
                value: JSON.stringify(record),
            }],
        });
        console.log("Record sent to topic: ", topic);
    }
    public close () {
        if (this.conditions.producer) this.producer.disconnect();
        if (this.conditions.consumer) this.consumer.disconnect();
        console.log("Disconnected (Kafka)");
    }
}

export default new KafkaMaker(broker, clientId, topics);