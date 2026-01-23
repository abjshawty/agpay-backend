export interface ResumeTransactionsOperateur {
    id: string
    date: Date
    operateurId: string
    montant: number
    nombreTransaction: number
}

export interface ResumeTransactionsJour {
    date: Date
    montant: number
    nombreTransaction: number
}