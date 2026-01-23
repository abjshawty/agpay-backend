const locale = {
  router: {
    idRequired: "La référence de l'objet est requise",
    statusRequired: "Le statut est requis",
  },
  controller: {
    notFound: "Enregistrement introuvable",
    notAuthorized: "Accès non autorisé",
    notAdminAccount: "Ce compte n'est pas administrateur",
    wrongObjectId: "L'identifiant de l'objet n'est pas valide",
    saverNotfound:
      "Impossible de vérifier l'identité de l'administrateur, veuillez vous reconnecter. Si le problème persiste contactez un administrateur système.",
    subcategoryNotfound: "Sous-categorie introuvable",
    successSave: "Enregistrement réussie!",
    successUpdate: "Modification réussie!",
    successRemove: "Enregistrement supprimé avec succès.",
    successMassiveRemove: "Enregistrement supprimés avec succès.",
    apiKeyNotFound: "Clé d'api introuvable",
    session: {
      ok: "Session ok",
      error: "Session invalide",
    },
    done: "Action éffectuée avec succès",
    draftDone: "Brouillon enregistré avec succès",
    notValidStatus: "Statut invalide",
    notValidEtape: "Etape invalide",
    sameStatusDetected:
      "Le statut sélectionné est déjà celui du dossier en cours",
    wrongStatusDetected:
      "Le statut sélectionné n'est pas celui attendu pour le traitement",
    isReadonly: "Ce dossier ne peut être édité",
    filesXdocsNotGood:
      "Le nombre de fichier sélectionné ne correspond pas au nombre de type de dossier",
    filesRequired: "Vous devez ajouter au moins un document pour la demande",
    wrongDate: "La date saisie est incorrecte",
  },
  notfound: (label: string = "") => {
    return `${label} introuvable`;
  },
  wrongJsonFormat: (label: string = "") => {
    return `${label} n'est pas dans un format JSON valide`;
  },
  wrongObjectId: (label: string = "") => {
    return `L'identifiant ${label} n'est pas valide`;
  },
  required: (label: string = "") => {
    return `${label} est un champs requis`;
  },
  exist: (label: string = "", custom: boolean = false) => {
    return custom
      ? `${label} existe déjà`
      : `Un enregistrement avec ${label} existe déjà`;
  },
  system: {
    errorTryCatchMessage: "Une erreur inattendue s'est produite.",
  },
  user: {
    connected: "Connexion éffectuée!",
    disconnected: "Déconnexion éffectuée!",
    unknownDomain: "L'adresse e-mail n'a pas un domaine valide",
  },
  profile: null,
};

export default locale;
