# 🔒 Documentation de Sécurité - Validation d'Accès Société

## Vue d'ensemble

Cette documentation décrit le système de sécurité mis en place pour **empêcher tout utilisateur d'accéder aux données d'une société dont il n'a pas les droits**, quel que soit son type (INTERNAL ou EXTERNAL).

**Principe fondamental** : **Zero-Trust Security Model**
Aucun utilisateur, même administrateur, ne peut contourner la validation d'accès aux sociétés.

---

## Architecture de Sécurité

### 1. Modèle de Données

#### Utilisateur (User)
```prisma
model User {
  id                String    @id @default(auto()) @map("_id") @db.ObjectId
  email             String    @unique
  type              String    @default("INTERNAL")  // INTERNAL ou EXTERNAL
  societyId         String[]  @db.ObjectId          // ⚠️ ARRAY de sociétés autorisées
  partnerId         String?   @db.ObjectId
  // ...
}
```

**Points clés** :
- `societyId` est un **array** : un utilisateur peut avoir accès à **plusieurs sociétés**
- `type` détermine le rôle (INTERNAL = admin, EXTERNAL = partenaire)
- La validation se base sur `user.societyId[]` chargé depuis la base de données

#### Transaction
```prisma
model Transaction {
  id                String     @id @default(auto()) @map("_id") @db.ObjectId
  societyId         String?    @db.ObjectId  // Société propriétaire de la transaction
  society           Society?   @relation(...)
  // ...
}
```

---

### 2. Flux de Sécurité

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Frontend envoie requête : GET /api/transactions?societyId=X │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Middleware d'authentification vérifie JWT                   │
│     → Extrait userData.id                                       │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Service Layer charge user depuis MongoDB                    │
│     → user = await prisma.user.findUnique({ where: { id } })   │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. VALIDATION SÉCURITÉ (pour TOUS les utilisateurs)           │
│                                                                  │
│  4.1. Vérifier que user.societyId[] existe et non vide         │
│       → Sinon : 403 "User has no society access"               │
│                                                                  │
│  4.2. Si filters.societyId fourni :                            │
│       → Vérifier que chaque ID ∈ user.societyId[]             │
│       → Si OUI : ✅ Validation OK                              │
│       → Si NON : ❌ 403 "Accès refusé à cette société"        │
│                                                                  │
│  4.3. Si filters.societyId non fourni :                        │
│       → Utiliser user.societyId (toutes les sociétés autorisées)│
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. Repository Layer filtre les transactions                    │
│     → WHERE societyId = <ID validé>                            │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. Retour des données UNIQUEMENT de la société autorisée      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implémentation Technique

### 3. Code de Validation (Service Layer)

**Fichier** : `src/services/transactions.ts`

#### 3.1. Fonction getAllPaginate (ligne 217-289)

```typescript
async getAllPaginate (
  userData: { id: string, iat: number; },
  currentPage: number,
  filters: { societyId?: string | string[]; /* ... */ }
) {
  try {
    // 1. Charger l'utilisateur depuis la base
    const user = await prisma.user.findUnique({
      where: { id: userData.id },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const userType = user.type;

    // 2. VALIDATION SÉCURITÉ (pour TOUS les utilisateurs)
    if (!user.societyId || user.societyId.length === 0) {
      const error: any = new Error("User has no society access");
      error.statusCode = 403;
      throw error;
    }

    if (filters.societyId) {
      // Valider que le societyId demandé est autorisé
      const requestedSocieties = Array.isArray(filters.societyId)
        ? filters.societyId
        : [filters.societyId];

      const hasAccess = requestedSocieties.every(sid =>
        user.societyId.includes(sid)
      );

      if (!hasAccess) {
        const error: any = new Error("Accès refusé à cette société");
        error.statusCode = 403;
        throw error;
      }
    } else {
      // Utiliser toutes les sociétés autorisées
      filters.societyId = user.societyId;
    }

    // 3. Logique spécifique au type d'utilisateur
    if (userType === "INTERNAL") {
      // Parsing pour admins (opérateurs multiples)
      if (typeof filters.operateurId === "string" && filters.operateurId) {
        filters.operateurId = filters.operateurId.split("-");
      }
    } else {
      // Forcer partnerId pour EXTERNAL
      filters.partnerId = user.partnerId ? user.partnerId : undefined;
    }

    // 4. Appel au repository avec filtres validés
    const result = await this.repo.getAllPaginate(currentPage, filters);
    return result;

  } catch (error: any) {
    if (!error.hasOwnProperty("statusCode")) {
      error.statusCode = 500;
    }
    throw error;
  }
}
```

---

### 4. Scénarios de Sécurité

#### 4.1. Utilisateur CIE (societyId = [CIE])

**Scénario 1** : Demande transactions CIE
```http
GET /api/transactions/paginate/1?societyId=691746a3d18a9affcdab6d2e
```
✅ **Résultat** : Transactions CIE retournées
✅ **Validation** : `691746a3d18a9affcdab6d2e` ∈ `user.societyId[]` → OK

---

**Scénario 2** : Demande transactions SODECI
```http
GET /api/transactions/paginate/1?societyId=691746a3d18a9affcdab6d2f
```
❌ **Résultat** : Erreur 403 "Accès refusé à cette société"
❌ **Validation** : `691746a3d18a9affcdab6d2f` ∉ `user.societyId[]` → REFUSÉ

---

#### 4.2. Utilisateur Multi-Sociétés (societyId = [CIE, SODECI])

**Scénario 1** : Demande transactions CIE
```http
GET /api/transactions/paginate/1?societyId=691746a3d18a9affcdab6d2e
```
✅ **Résultat** : Transactions CIE retournées
✅ **Validation** : `691746a3d18a9affcdab6d2e` ∈ `user.societyId[]` → OK

---

**Scénario 2** : Demande transactions SODECI
```http
GET /api/transactions/paginate/1?societyId=691746a3d18a9affcdab6d2f
```
✅ **Résultat** : Transactions SODECI retournées
✅ **Validation** : `691746a3d18a9affcdab6d2f` ∈ `user.societyId[]` → OK

---

**Scénario 3** : Aucun societyId fourni
```http
GET /api/transactions/paginate/1
```
✅ **Résultat** : Transactions CIE + SODECI retournées
✅ **Validation** : Utilise automatiquement `user.societyId = [CIE, SODECI]`

---

#### 4.3. Admin INTERNAL vs EXTERNAL

| Critère | INTERNAL | EXTERNAL |
|---------|----------|----------|
| **Validation société** | ✅ Appliquée | ✅ Appliquée |
| **Accès multi-sociétés** | ✅ Si dans user.societyId[] | ✅ Si dans user.societyId[] |
| **Parsing operateurId** | ✅ Multiple autorisé | ❌ Non |
| **Forçage partnerId** | ❌ Non | ✅ Oui |
| **Contournement possible** | ❌ NON | ❌ NON |

**Conclusion** : La validation s'applique **identiquement** à tous les types, seule la logique métier diffère.

---

## Endpoints Sécurisés

### 5. Liste des Endpoints Protégés

| Endpoint | Fichier | Ligne | Status |
|----------|---------|-------|--------|
| `getAllPaginate()` | transactions.ts | 217 | ✅ Sécurisé (v2.4.7) |
| `getPaginateDFC()` | transactions.ts | 272 | 🔄 En cours |
| `exportPaginatedData()` | transactions.ts | 304 | 🔄 En cours |
| `getLastNDaysTransactions()` | transactions.ts | 621 | 🔄 En cours |
| `getTransactionCountAndAmountByOperator()` | transactions.ts | 428 | 🔄 En cours |
| `getTransactionPercentageByOperator()` | transactions.ts | 368 | 🔄 En cours |
| `getByAmountPlages()` | transactions.ts | 32 | 🔄 En cours |

---

## Tests de Sécurité

### 6. Checklist de Test

#### Test 1 : Utilisateur CIE accède à CIE
```bash
curl -H "Authorization: Bearer <TOKEN_CIE>" \
  "http://localhost:3000/api/transactions/paginate/1?societyId=<ID_CIE>"
```
**Attendu** : 200 OK + transactions CIE

---

#### Test 2 : Utilisateur CIE accède à SODECI
```bash
curl -H "Authorization: Bearer <TOKEN_CIE>" \
  "http://localhost:3000/api/transactions/paginate/1?societyId=<ID_SODECI>"
```
**Attendu** : 403 Forbidden + "Accès refusé à cette société"

---

#### Test 3 : Utilisateur SODECI accède à SODECI
```bash
curl -H "Authorization: Bearer <TOKEN_SODECI>" \
  "http://localhost:3000/api/transactions/paginate/1?societyId=<ID_SODECI>"
```
**Attendu** : 200 OK + transactions SODECI

---

#### Test 4 : Utilisateur SODECI accède à CIE
```bash
curl -H "Authorization: Bearer <TOKEN_SODECI>" \
  "http://localhost:3000/api/transactions/paginate/1?societyId=<ID_CIE>"
```
**Attendu** : 403 Forbidden + "Accès refusé à cette société"

---

#### Test 5 : Admin multi-sociétés accède à toutes ses sociétés
```bash
curl -H "Authorization: Bearer <TOKEN_MULTI>" \
  "http://localhost:3000/api/transactions/paginate/1"
```
**Attendu** : 200 OK + transactions CIE + SODECI

---

#### Test 6 : Utilisateur sans societyId
```bash
curl -H "Authorization: Bearer <TOKEN_NO_SOCIETY>" \
  "http://localhost:3000/api/transactions/paginate/1"
```
**Attendu** : 403 Forbidden + "User has no society access"

---

## Maintenance et Évolution

### 7. Ajout d'un Nouvel Endpoint

Pour sécuriser un nouvel endpoint qui retourne des transactions :

1. **Charger l'utilisateur** :
   ```typescript
   const user = await prisma.user.findUnique({ where: { id: userData.id } });
   if (!user) throw new Error("User not found");
   ```

2. **Valider l'accès société** :
   ```typescript
   if (!user.societyId || user.societyId.length === 0) {
     const error: any = new Error("User has no society access");
     error.statusCode = 403;
     throw error;
   }
   ```

3. **Valider le societyId demandé** (si fourni) :
   ```typescript
   if (requestedSocietyId) {
     const requested = Array.isArray(requestedSocietyId)
       ? requestedSocietyId
       : [requestedSocietyId];

     const hasAccess = requested.every(sid => user.societyId.includes(sid));

     if (!hasAccess) {
       const error: any = new Error("Accès refusé à cette société");
       error.statusCode = 403;
       throw error;
     }
   }
   ```

4. **Utiliser le societyId validé** dans les filtres :
   ```typescript
   const filters = {
     societyId: requestedSocietyId || user.societyId,
     // ... autres filtres
   };
   ```

---

### 8. Bonnes Pratiques

✅ **À FAIRE** :
- Toujours valider l'accès **avant** d'appeler le repository
- Charger `user.societyId[]` depuis la base (pas depuis le JWT)
- Retourner une erreur **403** avec un message explicite
- Utiliser `user.societyId` (array) si aucun societyId n'est fourni
- Logger les tentatives d'accès refusé pour l'audit

❌ **À ÉVITER** :
- Faire confiance au societyId du frontend sans validation
- Créer des exceptions pour les admins
- Utiliser le JWT directement (peut être falsifié)
- Retourner une erreur 404 (masque l'existence des données)
- Ignorer la validation pour certains endpoints

---

## Historique des Versions

### Version 2.4.5 (17 nov 2025)
- 🐛 Correction : Suppression du filtre défensif bugué dans repository
- 🐛 Fix : Retour de toutes les sociétés quand pas de societyId fourni

### Version 2.4.6 (17 nov 2025)
- 🔒 Sécurité : Ajout validation d'accès pour utilisateurs EXTERNAL
- ✅ Validation basée sur user.societyId[] depuis MongoDB

### Version 2.4.7 (18 nov 2025)
- 🔒 Sécurité : Extension validation à TOUS les utilisateurs (INTERNAL inclus)
- ✅ Modèle Zero-Trust : Aucune exception, validation universelle

### Version 2.4.8 (18 nov 2025) - En cours
- 📚 Documentation : Ajout de SECURITY.md
- 🔒 Sécurité : Extension validation aux 6 endpoints restants

---

## Contact et Support

Pour toute question de sécurité :
- Créer une issue sur le dépôt Git avec le tag `[SECURITY]`
- Contacter l'équipe de développement

**Dernière mise à jour** : 18 novembre 2025
**Version** : 2.4.8
