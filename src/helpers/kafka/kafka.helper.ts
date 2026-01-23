import { Kafka } from 'kafkajs';

export class KafkaHelper {
  private kafka: Kafka;
  private consumer: any;
  private producer: any;

  constructor(config: { clientId: string, brokers: string[] }) {
    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers
    });
  }

  /**
   * Initialise et connecte un consumer Kafka
   * @param groupId - Identifiant du groupe de consommateurs
   * @returns Promise<void>
   */
  async initConsumer(groupId: string): Promise<void> {
    try {
      this.consumer = this.kafka.consumer({ groupId });
      await this.consumer.connect();
    } catch (error) {
      console.error('Erreur lors de l\'initialisation du consumer:', error);
      throw error;
    }
  }

  /**
   * S'abonne à un topic et traite les messages
   * @param topic - Nom du topic
   * @param messageHandler - Fonction de traitement des messages
   * @returns Promise<void>
   */
  async subscribe(topic: string, messageHandler: Function): Promise<void> {
    try {
      let tempres = await this.consumer.subscribe({ topic, fromBeginning: true });
      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }: any) => {
          try {
            await messageHandler({
              topic,
              partition,
              offset: message.offset,
              value: message.value?.toString(),
              timestamp: message.timestamp
            });
          } catch (error) {
            console.error('Erreur lors du traitement du message:', error);
          }
        }
      });
    } catch (error) {
      console.error('Erreur lors de la souscription:', error);
      throw error;
    }
  }

  /**
   * S'abonne à plusieurs topics et traite les messages
   * @param topics - Liste des noms de topics
   * @param messageHandler - Fonction de traitement des messages
   * @returns Promise<void>
   */
  async subscribeToMultipleTopics(topics: string[], messageHandler: Function): Promise<void> {
    try {
      // Subscribe to all topics
      for (const topic of topics) {
        await this.consumer.subscribe({ topic, fromBeginning: true });
      }

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }: any) => {
          try {
            await messageHandler({
              topic,
              partition,
              offset: message.offset,
              value: message.value?.toString(),
              timestamp: message.timestamp
            }, topic);
          } catch (error) {
            console.error('Erreur lors du traitement du message:', error);
          }
        }
      });
    } catch (error) {
      console.error('Erreur lors de la souscription aux topics:', error);
      throw error;
    }
  }

  /**
   * Déconnecte le consumer
   * @returns Promise<void> 
   */
  async disconnect(): Promise<void> {
    try {
      if (this.consumer) {
        await this.consumer.disconnect();
      }
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      throw error;
    }
  }
}

/* Guide d'utilisation:

1. Créer une instance:
const kafkaHelper = new KafkaHelper({
  clientId: 'test-app',
  brokers: ['10.10.140.110:9092']
});

2. Initialiser le consumer:
await kafkaHelper.initConsumer('test-group');

3. S'abonner à un topic:
await kafkaHelper.subscribe('SODECI-NMPF-REGLEMENTS', async (message) => {
  console.log('Message reçu:', message);
});

4. Pour arrêter:
await kafkaHelper.disconnect();

Tests possibles:
- Tester la connexion
- Tester la souscription
- Tester le traitement des messages
- Tester la gestion des erreurs
- Tester la déconnexion

*/
