import repo from "../repository/rtj";
import accountRepo from "../repository/accounts";
import societyRepo from "../repository/society";
import society from "./society";
// import { handleCIE } from "../helpers/sql/ms";
class Service {
    private repo = repo;
    private accountant = new accountRepo();
    private socialite = new societyRepo();
    async create (req: { date: string; }) {
        try {
            const before_date = new Date(req.date);
            const after_date = new Date(req.date);
            before_date.setHours(0, 0, 0, 0);
            after_date.setHours(23, 59, 59, 999);

            // const exists = await this.repo.getRTJ(before_date, );
            // console.log(exists);
            // if (exists) throw new Error("409 conflict");
            const new_rtj = await this.repo.add(before_date, after_date);
            return new_rtj;
        } catch (error: any) {
            if (!error.hasOwnProperty("statusCode")) {
                error.statusCode = 500;
            }
            throw error;
        }
    }

    // TODO: Rewrite this function to optimize performance
    async getAll (userData: { id: string, iat: number; }, societe: string, page: number, query: string, montant: number, dateFrom: string, dateTo: string) {
        try {
            const rtjs = await this.repo.getAll(userData, societe, page, query, montant, dateFrom, dateTo);
            return rtjs;
        } catch (error: any) {
            if (!error.hasOwnProperty("statusCode")) {
                error.statusCode = 500;
            }
            throw error;
        }
    }

    async getDetailed (userData: { id: string, iat: number; }, RTid: string) {
        try {
            const rtj = await this.repo.getDetailed(userData, RTid);
            if (!rtj) throw new Error("404 not found");
            const societe = rtj.societyId ? await this.socialite.getOneLite(rtj.societyId) : null;
            console.log("argocd");
            // @ts-ignore
            if (rtj.hasOwnProperty("status") && rtj.status === "Approuvé") {
                // @ts-ignore
                const source = await this.accountant.getRTJSource(rtj.source_account);
                console.log('source', source);
                // @ts-ignore
                const destination = await this.accountant.getRTJDestination(rtj.destination_account);
                const response = {
                    ...rtj,
                    source_account: source,
                    destination_account: destination,
                    society: societe
                };
                return response;
            }
            console.log("jenkins");

            return { ...rtj, society: societe };
        } catch (error: any) {
            if (!error.hasOwnProperty("statusCode")) {
                error.statusCode = 500;
            }
            throw error;
        }
    }
    async approveDfc (id: string, approval: boolean, content: { source?: string, destination?: string, message?: string; }, userData: { id: string, iat: number; }) {
        try {
            const result = await this.repo.approveDfc(id, approval, content, userData);
            return result;
        } catch (error: any) {
            if (!error.hasOwnProperty("statusCode")) {
                error.statusCode = 500;
            }
            throw error;
        }
    };

    async cleanup () {
        try {
            const result = await this.repo.cleanup();
            return result;
        } catch (error: any) {
            if (!error.hasOwnProperty("statusCode")) {
                error.statusCode = 500;
            }
            throw error;
        }
    }

    async forExport (societe: string, dateFrom?: string, dateTo?: string, partenaire?: string) {
        try {
            const result = await this.repo.searchAll(societe, dateFrom, dateTo, partenaire);
            return result;
        } catch (error: any) {
            if (!error.hasOwnProperty("statusCode")) {
                error.statusCode = 500;
            }
            throw error;
        }
    }

    async loadOld () {
        // handleCIE.getFrom(new Date());
        return 1;
    }
}

export default new Service();
