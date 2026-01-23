import users from "../services/users";

type Actions = "create" | "update" | "print" | "list" | "delete";
type Modules =
    "Profils" |
    "Sociétés" |
    "Partenaires" |
    "Banques" |
    "Comptes" |
    "Utilisateurs interne" |
    "Utilisateurs externe" |
    "Transactions" |
    "DFC" |
    "Journal des actions" |
    "Session" |
    "DFC Détails";

/**
 * Vérifie si l'utilisateur a l'autorisation d'effectuer une action sur un module
 * @param requestUser L'utilisateur qui effectue l'action
 * @param module Le module sur lequel l'action est effectuée
 * @param action L'action à effectuer
 * @returns true si l'utilisateur a l'autorisation, false sinon
 */
export default async function authorization (
    requestUser: any, module: Modules, action: Actions
): Promise<boolean> {
    if (!requestUser) return false;
    const userId = requestUser.id;
    const user = await users.getOne(userId);
    const features = user?.profile?.features;
    if (!features) return false;
    const feature = features?.find((feature: any) => feature.name === module);
    if (!feature) return false;
    const auth = feature.auth;
    switch (action) {
        case "create":
            return auth.cancreate;
        case "update":
            return auth.canupdate;
        case "print":
            return auth.canprint;
        case "list":
            return auth.canlist;
        case "delete":
            return auth.candelete;
        default:
            return false;
    }
}