import net from 'net';
import { Kafka } from 'kafkajs';

interface BrokerCheck {
  host: string;
  port: number;
  accessible: boolean;
  responseTime?: number;
}

export class KafkaDiagnostic {
  private brokers: string[];
  private clientId: string;

  constructor(brokers: string[], clientId: string) {
    this.brokers = brokers;
    this.clientId = clientId;
  }

  async checkBrokerConnectivity(): Promise<BrokerCheck[]> {
    const checks: Promise<BrokerCheck>[] = this.brokers.map(broker => {
      const [host, port] = broker.split(':');
      return this.checkConnection(host, parseInt(port));
    });

    return Promise.all(checks);
  }

  private checkConnection(host: string, port: number): Promise<BrokerCheck> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const socket = new net.Socket();

      socket.setTimeout(5000);  // 5 secondes timeout

      socket.on('connect', () => {
        const responseTime = Date.now() - startTime;
        socket.destroy();
        resolve({
          host,
          port,
          accessible: true,
          responseTime
        });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({
          host,
          port,
          accessible: false
        });
      });

      socket.on('error', () => {
        socket.destroy();
        resolve({
          host,
          port,
          accessible: false
        });
      });

      socket.connect(port, host);
    });
  }

  async checkConsumerGroupPermissions(groupId: string): Promise<{
    hasPermissions: boolean;
    details?: any;
    error?: string;
  }> {
    const kafka = new Kafka({
      clientId: this.clientId,
      brokers: this.brokers
    });

    const admin = kafka.admin();

    try {
      await admin.connect();

      // Vérifier si le groupe existe
      const groups = await admin.listGroups();
      const groupExists = groups.groups.some(g => g.groupId === groupId);

      // Vérifier les offsets du groupe
      const offsets = await admin.fetchOffsets({ groupId });

      await admin.disconnect();

      return {
        hasPermissions: true,
        details: {
          groupExists,
          offsets
        }
      };
    } catch (error: any) {
      return {
        hasPermissions: false,
        error: error.message
      };
    }
  }
}

// Exemple d'utilisation
async function runDiagnostic() {
  const brokers = (process.env.KAFKA_BROKERS || '').split(',');
  const clientId = process.env.KAFKA_CLIENT_ID || 'test-app';
  const diagnostic = new KafkaDiagnostic(brokers, clientId);

  console.log('🔍 Démarrage du diagnostic Kafka...');

  // Vérifier la connectivité des brokers
  console.log('\n📡 Vérification de la connectivité des brokers...');
  const connectivityResults = await diagnostic.checkBrokerConnectivity();
  connectivityResults.forEach(result => {
    console.log(`${result.accessible ? '✅' : '❌'} ${result.host}:${result.port} - ${result.accessible
      ? `Temps de réponse: ${result.responseTime}ms`
      : 'Non accessible'
      }`);
  });

  // Vérifier les permissions du groupe
  console.log('\n🔐 Vérification des permissions du groupe consumer...');
  const permissionsResult = await diagnostic.checkConsumerGroupPermissions('transactions-group');
  if (permissionsResult.hasPermissions) {
    console.log('✅ Permissions OK');
    console.log('📊 Détails:', JSON.stringify(permissionsResult.details, null, 2));
  } else {
    console.log('❌ Problème de permissions');
    console.log('⚠️ Erreur:', permissionsResult.error);
  }
}

// Exécuter le diagnostic si appelé directement
if (require.main === module) {
  runDiagnostic().catch(console.error);
}

export default KafkaDiagnostic; 