Je vais rédiger un tutoriel détaillé pour la prise en main de ce code. Je vais le structurer en plusieurs sections pour une meilleure compréhension.

# Tutoriel de prise en main du backend API

## 1. Vue d'ensemble du projet

Ce projet est une API backend construite avec :

- Fastify comme framework web
- Prisma comme ORM
- TypeScript comme langage de programmation
- Une architecture orientée service

### Structure principale du projet :

```
src/
├── api/
│   └── routes/        # Définition des routes API
├── services/          # Logique métier
├── repository/        # Accès aux données
├── interfaces/        # Types TypeScript
├── helpers/          # Utilitaires
├── externals/        # Configuration externe
└── data/             # Données statiques
```

## 2. Configuration initiale

### 2.1 Installation

1. Cloner le projet
2. Installer les dépendances :

```bash
npm install
```

3. Créer un fichier `.env` à la racine du projet avec les variables suivantes :

```env
PORT=8080
API_PATH=/v1
JWT_SECRET=votre_secret_jwt
```

### 2.2 Base de données

Le projet utilise Prisma comme ORM. Les modèles sont définis dans `prisma/schema.prisma`.

## 3. Architecture du code

### 3.1 Server Configuration

Le serveur est configuré dans la classe `Server`. Référence :

```20:101:src/externals/server.ts
export class Server {
  private server: FastifyInstance;

  constructor() {
    this.server = Fastify({ logger: true });
    this.config();
    this.routes();
    this.errorHandling();
  }

  private config(): void {
    //@ts-ignore
    this.server.register(jwt, { secret: process.env.JWT_SECRET! || "lelultpqsqgqdw4q9842" });
    this.server.register(fastifyMultipart, { addToBody: true });
    this.cors();
    this.server.register(swagger, swaggerConfig);

    // // Configuration optionnelle de Swagger UI si nécessaire
    this.server.register(swaggerUI, swaggerUiConfig);
  }

  private routes(): void {
    // Configure la route de base pour vérifier la version, par exemple
    const opts: RouteShorthandOptions = {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              version: { type: "string" },
            },
          },
        },
      },
    };

    this.server.get(
      `/api${process.env.API_PATH}/version`,
      opts,
      async (request, reply) => {
        try {
          const version = process.env.npm_package_version || "version inconnue";
          reply.status(200).send({ version });
        } catch (error: any) {
          request.log.error(`Erreur sur la route /version: ${error}`);
          reply.status(error.statusCode).send({ error: error.message });
        }
      },
    );

    // Enregistre les routes additionnelles
    this.server.register(routes, { prefix: `/api${process.env.API_PATH}` });
  }
  private cors(): void {
    this.server.register(cors, {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Content-Range', 'X-Content-Range'],
      credentials: true
    })
  }
  private errorHandling(): void {
    // Personnalise la gestion des erreurs ici
    this.server.setErrorHandler(
      (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
        console.error("une erreur s'est produite \n",error);
        reply.status(error.statusCode!).send({ message: error.message });
      },
    );
  }

  public async start(): Promise<void> {
    try {
      const port = parseInt(process.env.PORT || "8080", 10);
      await this.server.listen({ port, host: "0.0.0.0" });
      console.log(`Le serveur écoute sur le port ${port}`);
    } catch (error) {
      console.error("Erreur lors du démarrage du serveur:", error);
    }
  }
}
```

Points clés :

- Configuration CORS
- Configuration JWT
- Configuration Swagger
- Gestion des erreurs
- Configuration des routes

### 3.2 Système d'authentification

L'authentification est gérée via JWT et Keycloak. Voir :

```1:35:src/helpers/auth.ts
import { FastifyReply, FastifyRequest } from "fastify"
import service from '../services/users'

export const checkAuth = async (request: FastifyRequest,reply: FastifyReply,done)=>{
    try {
        await request.jwtVerify()
    }//@ts-ignore
    catch(e:any){
        reply.status(401)
        reply.send({message: "Unauthorized: authentification réquise"})
    }
}
export const onlyadmin = async (
  request: FastifyRequest,
  reply: FastifyReply,
  done
) => {
  try {
    const verify:any = await request.jwtVerify();
    const user = await service.getOne(verify.id);
    //@ts-ignore
    const profilsAutorises = ["admin", "super-admin", "superadmin"];
    if (!profilsAutorises.includes(String(user?.profile?.name))){
        console.log(profilsAutorises.includes(String(user?.profile?.name)))
        reply.status(401).send({
            message:
            "Unauthorized: un profil administrateur est réquis pour cette action",
        });
      }
      request.user = user as any; // Type assertion to avoid type error
  } catch (e: any) {
    console.log(e);
    reply.status(401).send({ message: "Unauthorized: authentification requise" });
  }
};
```

### 3.3 Gestion des profils et autorisations

Le système utilise un système de profils avec des features et des autorisations :

```1:18:src/interfaces/profils.ts
export interface Auth {
  cancreate: boolean;
  canupdate: boolean;
  canprint: boolean;
  canlist: boolean;
  candelete: boolean;
}
export interface Feature {
  id?: string;
  name: string;
  auth: Auth;
  description?: string; // Le champ est optionnel
}

export interface RequestBody {
  name: string;
  features: Feature[];
}
```

## 4. Points d'API principaux

### 4.1 Transactions

Les routes de transactions permettent de :

- Récupérer les transactions
- Exporter les données
- Gérer les approbations

Documentation complète :

```1:272:usages.md
Certainly! I'll provide usage examples and documentation in French for each route in the file. I'll present them in markdown format.

markdown
# Documentation des routes de transactions

## GET /:id

Récupère une transaction spécifique par son ID.

### Exemple d'utilisation

GET /transactions/123456


### Documentation
Cette route permet de récupérer les détails d'une transaction spécifique en utilisant son identifiant unique.

**Paramètres:**
- `id` (obligatoire): L'identifiant unique de la transaction.

**Réponse:**
- Code 200: Retourne les détails de la transaction.

---

## GET /export/:page

Exporte les données de transaction paginées dans différents formats.

### Exemple d'utilisation

GET /transactions/export/1?format=csv&query=paiement&canal=mobile&operateurId=op123&statutOperations=success&dateFrom=2023-01-01&dateTo=2023-12-31&societyId=soc456&codeSocietyId=CODE123


### Documentation
Cette route permet d'exporter les données de transaction paginées dans différents formats (CSV, Excel, PDF).

**Paramètres:**
- `page` (obligatoire): Le numéro de la page à exporter.
- `format` (obligatoire): Le format d'export ('csv', 'excel', ou 'pdf').
- `query` (optionnel): Terme de recherche.
- `canal` (optionnel): Canal de la transaction.
- `operateurId` (optionnel): ID de l'opérateur.
- `statutOperations` (optionnel): Statut des opérations.
- `dateFrom` (optionnel): Date de début (format: YYYY-MM-DD).
- `dateTo` (optionnel): Date de fin (format: YYYY-MM-DD).
- `societyId` (optionnel): ID de la société.
- `codeSocietyId` (optionnel): Code de la société.

**Réponse:**
- Code 200: Retourne un fichier au format spécifié.

---

## GET /paginate/:page

Récupère une liste paginée de transactions.

### Exemple d'utilisation

GET /transactions/paginate/1?query=paiement&canal=mobile&operateurId=op123&statutOperations=success&dateFrom=2023-01-01&dateTo=2023-12-31&societyId=soc456&codeSocietyId=CODE123


### Documentation
Cette route permet de récupérer une liste paginée de transactions avec des filtres optionnels.

**Paramètres:**
- `page` (obligatoire): Le numéro de la page à récupérer.
- `query` (optionnel): Terme de recherche.
- `canal` (optionnel): Canal de la transaction.
- `operateurId` (optionnel): ID de l'opérateur.
- `statutOperations` (optionnel): Statut des opérations.
- `dateFrom` (optionnel): Date de début (format: YYYY-MM-DD).
- `dateTo` (optionnel): Date de fin (format: YYYY-MM-DD).
- `societyId` (optionnel): ID de la société.
- `codeSocietyId` (optionnel): Code de la société.

**Réponse:**
- Code 200: Retourne la liste paginée des transactions.

---

## POST /load-chunkdata

Charge toutes les données depuis chunkdata.

### Exemple d'utilisation

POST /transactions/load-chunkdata


### Documentation
Cette route permet de charger toutes les données depuis chunkdata.

**Paramètres:** Aucun

**Réponse:**
- Code 200: Confirme que les données ont été chargées avec succès.

---

## GET /stats/percentage-by-operator

Récupère les pourcentages de transactions par opérateur.

### Exemple d'utilisation

GET /transactions/stats/percentage-by-operator


### Documentation
Cette route fournit des statistiques sur les pourcentages de transactions par opérateur.

**Paramètres:** Aucun

**Réponse:**
...
- `page` (obligatoire): Le numéro de la page à récupérer.
- `query` (optionnel): Terme de recherche.
- `canal` (optionnel): Canal de la transaction.
- `operateurId` (optionnel): ID de l'opérateur.
- `statutOperations` (optionnel): Statut des opérations.
- `dateFrom` (optionnel): Date de début (format: YYYY-MM-DD).
- `dateTo` (optionnel): Date de fin (format: YYYY-MM-DD).
- `societyId` (optionnel): ID de la société.
- `codeSocietyId` (optionnel): Code de la société.
- `itemsPerPage` (optionnel): Nombre d'éléments par page (défaut: 10).

**Réponse:**
- Code 200: Retourne les clôtures financières quotidiennes paginées.

---

## GET /paginate/:page/dfc/export

Exporte les clôtures financières quotidiennes paginées dans différents formats.

### Exemple d'utilisation

GET /transactions/paginate/1/dfc/export?format=csv&query=cloture&canal=mobile&operateurId=op123&statutOperations=success&dateFrom=2023-01-01&dateTo=2023-12-31&societyId=soc456&codeSocietyId=CODE123&itemsPerPage=20


### Documentation
Cette route permet d'exporter les clôtures financières quotidiennes paginées dans différents formats (CSV, Excel, PDF).

**Paramètres:**
- `page` (obligatoire): Le numéro de la page à exporter.
- `format` (obligatoire): Le format d'export ('csv', 'excel', ou 'pdf').
- `query` (optionnel): Terme de recherche.
- `canal` (optionnel): Canal de la transaction.
- `operateurId` (optionnel): ID de l'opérateur.
- `statutOperations` (optionnel): Statut des opérations.
- `dateFrom` (optionnel): Date de début (format: YYYY-MM-DD).
- `dateTo` (optionnel): Date de fin (format: YYYY-MM-DD).
- `societyId` (optionnel): ID de la société.
- `codeSocietyId` (optionnel): Code de la société.
- `itemsPerPage` (optionnel): Nombre d'éléments par page.

**Réponse:**
- Code 200: Retourne un fichier au format spécifié.

---

## POST /approbation

Crée une nouvelle approbation.

### Exemple d'utilisation

POST /transactions/approbation
Content-Type: application/json

{
  "status": "En cours d'analyse",
  "date": "2023-05-15T10:30:00Z",
  "commentaire": "Approbation en attente",
  "iduser": "user123",
  "comptePartenaire": "CP001",
  "compteSociete": "CS001"
}


### Documentation
Cette route permet de créer une nouvelle approbation.

**Paramètres du corps:**
- `status` (obligatoire): Statut de l'approbation ("En cours d'analyse", "Approuvé", ou "Non approuvé").
- `date` (optionnel): Date de l'approbation.
- `commentaire` (optionnel): Commentaire sur l'approbation.
- `iduser` (optionnel): ID de l'utilisateur.
- `comptePartenaire` (optionnel): Compte du partenaire.
- `compteSociete` (optionnel): Compte de la société.

**Réponse:**
- Code 200: Retourne les détails de l'approbation créée.

---

## PUT /approbation/:id

Met à jour une approbation existante.

### Exemple d'utilisation

PUT /transactions/approbation/123456
Content-Type: application/json

{
  "status": "Approuvé",
  "commentaire": "Approbation validée",
  "iduser": "user456"
}


### Documentation
Cette route permet de mettre à jour une approbation existante. Seuls les utilisateurs externes peuvent effectuer cette opération.

**Paramètres:**
- `id` (obligatoire): L'identifiant unique de l'approbation.

**Paramètres du corps:**
- `status` (optionnel): Nouveau statut de l'approbation.
- `date` (optionnel): Nouvelle date de l'approbation.
- `commentaire` (optionnel): Nouveau commentaire.
- `iduser` (optionnel): Nouvel ID de l'utilisateur.
- `comptePartenaire` (optionnel): Nouveau compte du partenaire.
- `file` (optionnel): Nouveau fichier associé.
- `compteSociete` (optionnel): Nouveau compte de la société.

**Réponse:**
- Code 200: Retourne les détails de l'approbation mise à jour.
- Code 403: Si l'utilisateur n'est pas externe.



Cette documentation fournit des exemples d'utilisation et des explications détaillées pour chaque route de l'API de transactions, en français et au format markdown.
```

### 4.2 Gestion des fichiers

Le service de fichiers permet :

- Upload de fichiers
- Conversion en base64
- Récupération des fichiers

Voir l'implémentation :

```1:54:src/services/files.ts
import { FileBody } from "../interfaces/files";
import Repository from "../repository/files";
class FilesService {
  private repo = new Repository();
  async create(file: any) {
    try {
      console.log(typeof file.data); // devrait imprimer 'object'
      console.log(Buffer.isBuffer(file.data)); // devrait imprimer 'true'
      console.log(file.data.length);
      const b64 = file.data.toString("base64");
      const new_element = await this.repo.add({ b64 });
      return new_element;
    } catch (error: any) {
      //@ts-ignore
      if (!error.hasOwnProperty("statusCode")) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
  async getAll() {
    try {
    const elements = await this.repo.getAll();
    return elements;
  } catch (error: any) {
    if (!error.hasOwnProperty("statusCode")) {
      error.statusCode = 500;
    }
    throw error;
  }
  }
  async getOne(id: string) {
    try {
    const one = await this.repo.getOne(id);
    return one?.b64;
  } catch (error: any) {
    if (!error.hasOwnProperty("statusCode")) {
      error.statusCode = 500;
    }
    throw error;
  }
  }
  async getAllPaginate(currentPage: number) {
    try {
    const result = await this.repo.getAllPaginate(currentPage);
    return result;
  } catch (error: any) {
    if (!error.hasOwnProperty("statusCode")) {
      error.statusCode = 500;
    }
    throw error;
  }
  }
}
```

## 5. Déploiement

Le projet inclut :

- Un fichier Jenkinsfile pour l'intégration continue
- Des scripts de build pour la production
- Un script de déploiement automatisé

### 5.1 Build pour la production

```bash
npm run build
```

### 5.2 Démarrage du serveur

```bash
npm start
```

## 6. Bonnes pratiques

1. **Gestion des erreurs** : Toutes les erreurs sont centralisées et formatées de manière cohérente.

2. **Validation** : Utilisation de schémas Fastify pour la validation des requêtes.

3. **Logs** : Système de logging intégré pour le suivi des opérations.

4. **Sécurité** :
   - Validation des types de fichiers
   - Protection CORS
   - Authentification JWT
   - Vérification des rôles

## 7. Développement

Pour le développement :

```bash
npm run dev
```

Cela lancera le serveur en mode développement avec :

- Hot reload
- Logs détaillés
- Documentation Swagger accessible sur `/documentation`

## 8. Tests

Pour exécuter les tests :

```bash
npm test
```

## 9. Documentation

La documentation complète de l'API est disponible via Swagger UI une fois le serveur lancé :
`http://localhost:8080/documentation`

Ce tutoriel couvre les aspects principaux du projet. Pour plus de détails sur des fonctionnalités spécifiques, consultez les commentaires dans le code et la documentation Swagger.
