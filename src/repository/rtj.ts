import { PrismaClient, Society, TransactionStatus } from "@prisma/client";
import client from "../data/client";


class Repository {
  /**
   * Helper function to calculate DFC status based on transactions
   * Returns: 0 (Analyzing), 1 (Approved), or 2 (Rejected)
   */
  private calculateDfcStatus (transactions: Array<{ status: TransactionStatus; }>): number {
    const statuses = transactions.map(t => t.status);

    // If all approved → status = 1
    if (statuses.length > 0 && statuses.every(s => s === TransactionStatus.Approved)) {
      return 1;
    }

    // If some analyzing → status = 0
    if (statuses.some(s => s === TransactionStatus.Analyzing)) {
      return 0;
    }

    // If some rejected → status = 2
    if (statuses.some(s => s === TransactionStatus.Rejected)) {
      return 2;
    }

    // Default: analyzing
    return 0;
  }

  /**
   * Helper function to convert numeric status to string (for backward compatibility)
   * Returns: "Approuvé", "En cours", or "Rejeté"
   * Accepts both number and string for backward compatibility
   */
  private formatStatus (status: number | string): string {
    const numStatus = typeof status === 'string' ? parseInt(status, 10) : status;
    switch (numStatus) {
      case 1:
        return "Approuvé";
      case 2:
        return "Rejeté";
      case 0:
      default:
        return "En cours";
    }
  }

  async actualize (dateFlux: Date) {
    // Set Time to the appropriate DFC storage standard (12:00 AM)
    dateFlux.setHours(0, 0, 0, 0);

    // Get IDs for the two main societies (CIE/SODECI)
    const CIE = await client.society.findFirst({ where: { name: 'CIE' } });
    const SODECI = await client.society.findFirst({ where: { name: 'SODECI' } });

    // Throw if one of the societies don't exist
    if (!CIE || !SODECI) {
      throw new Error("SODECI/CIE Not Found!");
    }

    // Establish the dates we're keeping in count
    const followingDay = new Date(dateFlux);
    followingDay.setDate(dateFlux.getDate() + 1);

    // How many total transactions ?
    const numberOfTransactions = {
      CIE: await client.transaction.count({
        where: {
          dateFlux: {
            gte: dateFlux,
            lte: followingDay
          },
          societyId: CIE.id
        }
      }),
      SODECI: await client.transaction.count({
        where: {
          dateFlux: {
            gte: dateFlux,
            lte: followingDay
          },
          societyId: SODECI.id
        }
      })
    };

    // How many SV2 transactions?
    const SV2 = {
      CIE: await client.transaction.count({
        where: {
          dateFlux: {
            gte: dateFlux,
            lte: followingDay
          },
          societyId: CIE.id,
          source: 'SV2'
        }
      }),
      SODECI: await client.transaction.count({
        where: {
          dateFlux: {
            gte: dateFlux,
            lte: followingDay
          },
          societyId: SODECI.id,
          source: 'SV2'
        }
      })
    };

    // How many SV3 transactions?
    const SV3 = {
      CIE: await client.transaction.count({
        where: {
          dateFlux: {
            gte: dateFlux,
            lte: followingDay
          },
          societyId: CIE.id,
          source: 'SV3'
        }
      }),
      SODECI: await client.transaction.count({
        where: {
          dateFlux: {
            gte: dateFlux,
            lte: followingDay
          },
          societyId: SODECI.id,
          source: 'SV3'
        }
      })
    };

    // Transaction Objects
    const transactions = {
      CIE: await client.transaction.findMany({
        where: {
          dateFlux: {
            gte: dateFlux,
            lte: followingDay
          },
          societyId: CIE.id
        }
      }),
      SODECI: await client.transaction.findMany({
        where: {
          dateFlux: {
            gte: dateFlux,
            lte: followingDay
          },
          societyId: SODECI.id
        }
      })
    };

    // Upsert the DFCs (UPDATE if exists, CREATE if not)
    const DFC_CIE = await client.resumeTransactionsJour.upsert({
      where: {
        date_societyId: {
          date: dateFlux,
          societyId: CIE.id
        }
      },
      update: {
        nombreTransaction: numberOfTransactions.CIE,
        montant: transactions.CIE.reduce((sum, transaction) => sum + transaction.montant, 0),
        sv2: SV2.CIE,
        sv3: SV3.CIE
      },
      create: {
        date: dateFlux,
        nombreTransaction: numberOfTransactions.CIE,
        montant: transactions.CIE.reduce((sum, transaction) => sum + transaction.montant, 0),
        sv2: SV2.CIE,
        sv3: SV3.CIE,
        societyId: CIE.id
      }
    });

    const DFC_SODECI = await client.resumeTransactionsJour.upsert({
      where: {
        date_societyId: {
          date: dateFlux,
          societyId: SODECI.id
        }
      },
      update: {
        nombreTransaction: numberOfTransactions.SODECI,
        montant: transactions.SODECI.reduce((sum, transaction) => sum + transaction.montant, 0),
        sv2: SV2.SODECI,
        sv3: SV3.SODECI
      },
      create: {
        date: dateFlux,
        nombreTransaction: numberOfTransactions.SODECI,
        montant: transactions.SODECI.reduce((sum, transaction) => sum + transaction.montant, 0),
        sv2: SV2.SODECI,
        sv3: SV3.SODECI,
        societyId: SODECI.id
      }
    });

    // List the partners for external DFCs generation
    const operators = await client.partner.findMany({ select: { id: true } });

    // Create a new DFC for each operator
    for (const operator of operators) {
      const numberOfTransactionsByOperator = {
        CIE: await client.transaction.count({
          where: {
            dateFlux: {
              gte: dateFlux,
              lte: followingDay
            },
            societyId: CIE.id,
            operateurId: operator.id
          }
        }),
        SODECI: await client.transaction.count({
          where: {
            dateFlux: {
              gte: dateFlux,
              lte: followingDay
            },
            societyId: SODECI.id,
            operateurId: operator.id
          }
        })
      };
      const transactionsByOperator = {
        CIE: await client.transaction.findMany({
          where: {
            dateFlux: {
              gte: dateFlux,
              lte: followingDay
            },
            societyId: CIE.id,
            operateurId: operator.id
          }
        }),
        SODECI: await client.transaction.findMany({
          where: {
            dateFlux: {
              gte: dateFlux,
              lte: followingDay
            },
            societyId: SODECI.id,
            operateurId: operator.id
          }
        })
      };
      const SV2ByOperator = {
        CIE: await client.transaction.count({
          where: {
            dateFlux: {
              gte: dateFlux,
              lte: followingDay
            },
            societyId: CIE.id,
            source: 'SV2',
            operateurId: operator.id
          }
        }),
        SODECI: await client.transaction.count({
          where: {
            dateFlux: {
              gte: dateFlux,
              lte: followingDay
            },
            societyId: SODECI.id,
            source: 'SV2',
            operateurId: operator.id
          }
        })
      };
      const SV3ByOperator = {
        CIE: await client.transaction.count({
          where: {
            dateFlux: {
              gte: dateFlux,
              lte: followingDay
            },
            societyId: CIE.id,
            source: 'SV3',
            operateurId: operator.id
          }
        }),
        SODECI: await client.transaction.count({
          where: {
            dateFlux: {
              gte: dateFlux,
              lte: followingDay
            },
            societyId: SODECI.id,
            source: 'SV3',
            operateurId: operator.id
          }
        })
      };
      // Calculate status based on transactions for this operator
      const statusCIE = this.calculateDfcStatus(transactionsByOperator.CIE);
      const statusSODECI = this.calculateDfcStatus(transactionsByOperator.SODECI);

      // Upsert DFC for CIE operator (preserves existing approvals)
      const DFC_CIE_OP = await client.resumeTransactionsOperateur.upsert({
        where: {
          operateurId_date_societyId: {
            operateurId: operator.id,
            date: dateFlux,
            societyId: CIE.id
          }
        },
        update: {
          nombreTransaction: numberOfTransactionsByOperator.CIE,
          montant: transactionsByOperator.CIE.reduce((sum, transaction) => sum + transaction.montant, 0),
          sv2: SV2ByOperator.CIE,
          sv3: SV3ByOperator.CIE,
          status: statusCIE
        },
        create: {
          date: dateFlux,
          nombreTransaction: numberOfTransactionsByOperator.CIE,
          montant: transactionsByOperator.CIE.reduce((sum, transaction) => sum + transaction.montant, 0),
          sv2: SV2ByOperator.CIE,
          sv3: SV3ByOperator.CIE,
          societyId: CIE.id,
          operateurId: operator.id,
          status: statusCIE
        }
      });

      // Upsert DFC for SODECI operator (preserves existing approvals)
      const DFC_SODECI_OP = await client.resumeTransactionsOperateur.upsert({
        where: {
          operateurId_date_societyId: {
            operateurId: operator.id,
            date: dateFlux,
            societyId: SODECI.id
          }
        },
        update: {
          nombreTransaction: numberOfTransactionsByOperator.SODECI,
          montant: transactionsByOperator.SODECI.reduce((sum, transaction) => sum + transaction.montant, 0),
          sv2: SV2ByOperator.SODECI,
          sv3: SV3ByOperator.SODECI,
          status: statusSODECI
        },
        create: {
          date: dateFlux,
          nombreTransaction: numberOfTransactionsByOperator.SODECI,
          montant: transactionsByOperator.SODECI.reduce((sum, transaction) => sum + transaction.montant, 0),
          sv2: SV2ByOperator.SODECI,
          sv3: SV3ByOperator.SODECI,
          societyId: SODECI.id,
          operateurId: operator.id,
          status: statusSODECI
        }
      });
    }

    // Delete the empty DFCs
    await client.resumeTransactionsJour.deleteMany({
      where: {
        montant: 0
      }
    }),

      await client.resumeTransactionsOperateur.deleteMany({
        where: {
          montant: 0
        }
      });
  }
  // async actualizeThroughDuplication (dateFlux: Date, operateurId: string) {
  //   const exist = await client.resumeTransactionsOperateur.findFirst({
  //     where: {
  //       date: dateFlux,
  //       operateurId: operateurId
  //     }
  //   });
  //   if (exist && exist.status == 0) {
  //     await client.resumeTransactionsOperateur.delete({
  //       where: {
  //         id: exist.id
  //       }
  //     });
  //   } else if (exist) {
  //     await client.resumeTransactionsOperateur.update({
  //       where: {
  //         id: exist.id
  //       },
  //       data: {
  //         status: 3
  //       }
  //     });
  //   }

  //   // Get IDs for the two main societies (CIE/SODECI)
  //   const CIE = await client.society.findFirst({ where: { name: 'CIE' } });
  //   const SODECI = await client.society.findFirst({ where: { name: 'SODECI' } });

  //   // Throw if one of the societies don't exist
  //   if (!CIE || !SODECI) {
  //     throw new Error("SODECI/CIE Not Found!");
  //   }

  //   // Establish the dates we're keeping in count
  //   const followingDay = new Date(dateFlux);
  //   followingDay.setDate(dateFlux.getDate() + 1);

  //   const numberOfTransactionsByOperator = {
  //     CIE: await client.transaction.count({
  //       where: {
  //         dateFlux: {
  //           gte: dateFlux,
  //           lte: followingDay
  //         },
  //         societyId: CIE.id,
  //         operateurId: operateurId
  //       }
  //     }),
  //     SODECI: await client.transaction.count({
  //       where: {
  //         dateFlux: {
  //           gte: dateFlux,
  //           lte: followingDay
  //         },
  //         societyId: SODECI.id,
  //         operateurId: operateurId
  //       }
  //     })
  //   };
  //   const transactionsByOperator = {
  //     CIE: await client.transaction.findMany({
  //       where: {
  //         dateFlux: {
  //           gte: dateFlux,
  //           lte: followingDay
  //         },
  //         societyId: CIE.id,
  //         operateurId: operateurId
  //       }
  //     }),
  //     SODECI: await client.transaction.findMany({
  //       where: {
  //         dateFlux: {
  //           gte: dateFlux,
  //           lte: followingDay
  //         },
  //         societyId: SODECI.id,
  //         operateurId: operateurId
  //       }
  //     })
  //   };
  //   const SV2ByOperator = {
  //     CIE: await client.transaction.count({
  //       where: {
  //         dateFlux: {
  //           gte: dateFlux,
  //           lte: followingDay
  //         },
  //         societyId: CIE.id,
  //         source: 'SV2',
  //         operateurId: operateurId
  //       }
  //     }),
  //     SODECI: await client.transaction.count({
  //       where: {
  //         dateFlux: {
  //           gte: dateFlux,
  //           lte: followingDay
  //         },
  //         societyId: SODECI.id,
  //         source: 'SV2',
  //         operateurId: operateurId
  //       }
  //     })
  //   };
  //   const SV3ByOperator = {
  //     CIE: await client.transaction.count({
  //       where: {
  //         dateFlux: {
  //           gte: dateFlux,
  //           lte: followingDay
  //         },
  //         societyId: CIE.id,
  //         source: 'SV3',
  //         operateurId: operateurId
  //       }
  //     }),
  //     SODECI: await client.transaction.count({
  //       where: {
  //         dateFlux: {
  //           gte: dateFlux,
  //           lte: followingDay
  //         },
  //         societyId: SODECI.id,
  //         source: 'SV3',
  //         operateurId: operateurId
  //       }
  //     })
  //   };
  //   const DFC_CIE_OP = await client.resumeTransactionsOperateur.create({
  //     data: {
  //       date: dateFlux,
  //       nombreTransaction: numberOfTransactionsByOperator.CIE,
  //       montant: transactionsByOperator.CIE.reduce((sum, transaction) => sum + transaction.montant, 0),
  //       sv2: SV2ByOperator.CIE,
  //       sv3: SV3ByOperator.CIE,
  //       societyId: CIE.id,
  //       operateurId: operateurId
  //     }
  //   });
  //   const DFC_SODECI_OP = await client.resumeTransactionsOperateur.create({
  //     data: {
  //       date: dateFlux,
  //       nombreTransaction: numberOfTransactionsByOperator.SODECI,
  //       montant: transactionsByOperator.SODECI.reduce((sum, transaction) => sum + transaction.montant, 0),
  //       sv2: SV2ByOperator.SODECI,
  //       sv3: SV3ByOperator.SODECI,
  //       societyId: SODECI.id,
  //       operateurId: operateurId
  //     }
  //   });
  // }
  /**
   * @deprecated This method is deprecated as of the refactoring.
   * DFCs are now calculated in real-time from the Transaction collection.
   * This method is kept for backward compatibility only and should not be used for new implementations.
   *
   * Previously, this method created static snapshots of DFCs in ResumeTransactionsJour.
   * Now, getAll() and getDetailed() calculate DFCs dynamically, ensuring they are always up-to-date.
   */
  async add (before_date: Date, after_date: Date) {
    const error: any = new Error("Création impossible, une RTJ avec ce nom existe déja");
    const exist = await client.resumeTransactionsJour.findMany({
      where: {
        date: {
          lte: after_date,
          gte: before_date
        }
      }
    });
    if (exist.length > 0) {
      let today = new Date();
      today.setHours(0, 0, 0, 0);
      if (exist[0].date.getTime() === today.getTime()) {
        console.log("Deleting existing RTJ");
        await client.resumeTransactionsJour.deleteMany({
          where: {
            date: {
              lte: after_date,
              gte: before_date
            }
          }
        });
      }
      else {
        return {
          main: {
            cie: exist
          }
        };
      }
    }

    const result = { main: { cie: null as any, sodeci: null as any }, aux: [] as any[] };
    const CIEid = await client.society.findFirst({ where: { name: "CIE" } });
    const SODECIid = await client.society.findFirst({ where: { name: "SODECI" } });

    // Create a new RTO for CIE
    const nombreTransactionCIE = await client.transaction.count({
      where: {
        dateFlux: {
          lte: after_date,
          gte: before_date
        }, society: { name: "CIE" }
      }
    });
    const sv2CIE = await client.transaction.count({
      where: {
        dateFlux: {
          lte: after_date,
          gte: before_date
        }, society: { name: "CIE" }, source: "SV2"
      }
    });
    const sv3CIE = await client.transaction.count({
      where: {
        dateFlux: {
          lte: after_date,
          gte: before_date
        }, society: { name: "CIE" }, source: "SV3"
      }
    });
    const transactionsCIE = await client.transaction.findMany({
      where: {
        dateFlux: {
          lte: after_date,
          gte: before_date
        }, society: { name: "CIE" }
      }
    });
    const montantCIE = transactionsCIE.reduce((sum, t) => sum + t.montant, 0);

    result.main.cie = await client.resumeTransactionsJour.create({
      data: {
        date: before_date,
        nombreTransaction: nombreTransactionCIE,
        montant: montantCIE,
        societyId: CIEid?.id || "66fc3343aacef78f32d8703d",
        sv2: sv2CIE,
        sv3: sv3CIE
      }
    });

    console.log(`${nombreTransactionCIE} transactions were done between ${before_date} and ${after_date} for a total of ${montantCIE} in CIE`);

    // Create a new RTO for SODECI
    const nombreTransactionSODECI = await client.transaction.count({
      where: {
        dateFlux: {
          lte: after_date,
          gte: before_date
        }, society: { name: "SODECI" }
      }
    });
    const sv2SODECI = await client.transaction.count({
      where: {
        dateFlux: {
          lte: after_date,
          gte: before_date
        }, society: { name: "SODECI" }, source: "SV2"
      }
    });
    const sv3SODECI = await client.transaction.count({
      where: {
        dateFlux: {
          lte: after_date,
          gte: before_date
        }, society: { name: "SODECI" }, source: "SV3"
      }
    });
    const transactionsSODECI = await client.transaction.findMany({
      where: {
        dateFlux: {
          lte: after_date,
          gte: before_date
        }, society: { name: "SODECI" }
      }
    });
    const montantSODECI = transactionsSODECI.reduce((sum, t) => sum + t.montant, 0);

    result.main.sodeci = await client.resumeTransactionsJour.create({
      data: {
        date: before_date,
        nombreTransaction: nombreTransactionSODECI,
        montant: montantSODECI,
        societyId: SODECIid!.id,
        sv2: sv2SODECI,
        sv3: sv3SODECI
      }
    });

    console.log(`${nombreTransactionSODECI} transactions were done between ${before_date} and ${after_date} for a total of ${montantSODECI} in SODECI`);


    const operators = await client.partner.findMany({ select: { id: true } });

    // Create a new RTO for each operator, CIE
    for (const opId of operators) {
      const numberOfTransactions = await client.transaction.count({
        where: {
          dateFlux: {
            lte: after_date,
            gte: before_date
          }, operateurId: opId.id, society: { name: "CIE" }
        }
      });
      const transactions = await client.transaction.findMany({
        where: {
          dateFlux: {
            lte: after_date,
            gte: before_date
          }, operateurId: opId.id, society: { name: "CIE" }
        }
      });
      const sv2CIE = await client.transaction.count({
        where: {
          dateFlux: {
            lte: after_date,
            gte: before_date
          }, operateurId: opId.id, society: { name: "CIE" }, source: "SV2"
        }
      });
      const sv3CIE = await client.transaction.count({
        where: {
          dateFlux: {
            lte: after_date,
            gte: before_date
          }, operateurId: opId.id, society: { name: "CIE" }, source: "SV3"
        }
      });
      const montantIndividuel = transactions.reduce((sum, t) => sum + t.montant, 0);
      const resultAux = await client.resumeTransactionsOperateur.create({
        data: {
          date: before_date,
          nombreTransaction: numberOfTransactions,
          montant: montantIndividuel,
          operateurId: opId.id,
          societyId: CIEid!.id,
          sv2: sv2CIE,
          sv3: sv3CIE
        }
      });
      result.aux.push(resultAux);
    }

    // Create a new RTO for each operator, SODECI
    for (const opId of operators) {
      const numberOfTransactions = await client.transaction.count({
        where: {
          dateFlux: {
            lte: after_date,
            gte: before_date
          }, operateurId: opId.id, society: { name: "SODECI" }
        }
      });
      const sv2SODECI = await client.transaction.count({
        where: {
          dateFlux: {
            lte: after_date,
            gte: before_date
          }, operateurId: opId.id, society: { name: "SODECI" }, source: "SV2"
        }
      });
      const sv3SODECI = await client.transaction.count({
        where: {
          dateFlux: {
            lte: after_date,
            gte: before_date
          }, operateurId: opId.id, society: { name: "SODECI" }, source: "SV3"
        }
      });
      const transactions = await client.transaction.findMany({
        where: {
          dateFlux: {
            lte: after_date,
            gte: before_date
          }, operateurId: opId.id, society: { name: "SODECI" }
        }
      });
      const montantIndividuel = transactions.reduce((sum, t) => sum + t.montant, 0);
      const resultAux = await client.resumeTransactionsOperateur.create({
        data: {
          date: before_date,
          nombreTransaction: numberOfTransactions,
          montant: montantIndividuel,
          operateurId: opId.id,
          societyId: SODECIid!.id,
          sv2: sv2SODECI,
          sv3: sv3SODECI
        }
      });
      result.aux.push(resultAux);
    }
    return result;
  }
  async getRTJ (date: Date, operator: string) {
    return await client.resumeTransactionsOperateur.findMany({
      where: {
        date: date,
        operateurId: operator
      }
    });
  }
  async getAll (userData: { id: string, iat: number; }, societe: string, currentPage: number, query: string, montant: number, dateFrom: string, dateTo: string) {
    const itemsPerPage = 10;
    const user = await client.user.findUnique({ where: { id: userData.id }, include: { societies: { select: { name: true } } } });
    if (!user) {
      throw new Error("User not found");
    }

    console.log(user.email, user.username, user.type);

    // Get society ID (used for both INTERNAL and EXTERNAL)
    const society = await client.society.findFirst({ where: { name: societe.toUpperCase() } });
    if (!society) {
      return { record: [], itemsPerPage, count: 0, totalPages: 0, currentPage };
    }

    if (user.type === "INTERNAL") {
      // ===== OPTIMIZED WITH MONGODB AGGREGATION PIPELINE =====

      console.log("🔍 DFC AGGREGATION DEBUG - START");
      console.log("User:", user.email, "Type:", user.type);
      console.log("Society:", society.name, "ID:", society.id);
      console.log("Filters - dateFrom:", dateFrom, "dateTo:", dateTo, "query:", query, "montant:", montant);

      // Build base match conditions
      // IMPORTANT: Use MongoDB Extended JSON format for ObjectId and Date
      // Prisma's aggregateRaw serializes the pipeline to JSON, so we need the Extended JSON format
      const matchConditions: any = { societyId: { $oid: society.id } };
      if (dateFrom) matchConditions.dateFlux = { $gte: { $date: new Date(dateFrom).toISOString() } };
      if (dateTo) matchConditions.dateFlux = { ...matchConditions.dateFlux, $lte: { $date: new Date(dateTo).toISOString() } };

      // Prefetch operator IDs when query is provided to avoid $lookup
      if (query) {
        const matchingOperators = await client.partner.findMany({
          where: { name: { contains: query, mode: "insensitive" } },
          select: { id: true }
        });

        if (matchingOperators.length === 0) {
          return { record: [], itemsPerPage, count: 0, totalPages: 0, currentPage };
        }

        matchConditions.operateurId = {
          $in: matchingOperators.map(op => ({ $oid: op.id }))
        };
      }

      console.log("📊 Match Conditions:", JSON.stringify(matchConditions, null, 2));
      console.log("🔑 SocietyId format:", matchConditions.societyId);

      // Quick test: Check if any transactions exist for this society
      const testCount = await client.transaction.count({ where: { societyId: society.id } });
      console.log("🧪 TEST - Total transactions for society:", testCount);

      // Build aggregation pipeline for DFC calculation with operator details
      const pipeline: any[] = [
        // Stage 1: Filter transactions
        { $match: matchConditions },

        // Stage 2: Add date-only field (without time)
        {
          $addFields: {
            dateOnly: {
              $dateToString: { format: "%Y-%m-%d", date: "$dateFlux", timezone: "UTC" }
            }
          }
        },

        // Stage 2b: Add status flags for day-level percentage calculations
        {
          $addFields: {
            approvedFlag: { $cond: [{ $eq: ["$status", "Approved"] }, 1, 0] },
            analyzingFlag: { $cond: [{ $eq: ["$status", "Analyzing"] }, 1, 0] }
          }
        },

        // Stage 3: Group by date + operator (for details level)
        {
          $group: {
            _id: {
              date: "$dateOnly",
              operateurId: "$operateurId"
            },
            montant: { $sum: "$montant" },
            nombreTransaction: { $sum: 1 },
            sv2: { $sum: { $cond: [{ $eq: ["$source", "SV2"] }, 1, 0] } },
            sv3: { $sum: { $cond: [{ $eq: ["$source", "SV3"] }, 1, 0] } },
            statuses: { $push: "$status" },
            approvedCount: { $sum: "$approvedFlag" },
            analyzingCount: { $sum: "$analyzingFlag" }
          }
        },

        // Stage 6: Add computed status field for operator details
        {
          $addFields: {
            statusNumeric: {
              $cond: [
                { $allElementsTrue: [{ $map: { input: "$statuses", as: "s", in: { $eq: ["$$s", "Approved"] } } }] },
                1, // All approved
                {
                  $cond: [
                    { $in: ["Rejected", "$statuses"] },
                    2, // Has rejected
                    0  // Analyzing
                  ]
                }
              ]
            }
          }
        },

        // Stage 4b: Compute percentages at day level
        {
          $addFields: {
            tauxApprobationNumeric: {
              $cond: [
                { $eq: ["$nombreTransaction", 0] },
                0,
                { $multiply: [{ $divide: ["$approvedCount", "$nombreTransaction"] }, 100] }
              ]
            },
            analyseEnCoursNumeric: {
              $cond: [
                { $eq: ["$nombreTransaction", 0] },
                0,
                { $multiply: [{ $divide: ["$analyzingCount", "$nombreTransaction"] }, 100] }
              ]
            }
          }
        },

        // Stage 7: Group by date (day level) with details
        {
          $group: {
            _id: "$_id.date",
            montant: { $sum: "$montant" },
            nombreTransaction: { $sum: "$nombreTransaction" },
            sv2: { $sum: "$sv2" },
            sv3: { $sum: "$sv3" },
            approvedCount: { $sum: "$approvedCount" },
            analyzingCount: { $sum: "$analyzingCount" },
            details: {
              $push: {
                id: { $concat: ["$_id.date", "_", { $toString: "$_id.operateurId" }] },
                date: { $toDate: "$_id.date" },
                montant: "$montant",
                nombreTransaction: "$nombreTransaction",
                message: null,
                source_account: null,
                destination_account: null,
                statusNumeric: "$statusNumeric",
                operateurId: "$_id.operateurId",
                approvedBy: null,
                sv2: "$sv2",
                sv3: "$sv3"
              }
            }
          }
        },

        // Stage 7b: Compute approval/analyzing percentages at day level
        {
          $addFields: {
            tauxApprobationNumeric: {
              $cond: [
                { $eq: ["$nombreTransaction", 0] },
                0,
                { $multiply: [{ $divide: ["$approvedCount", "$nombreTransaction"] }, 100] }
              ]
            },
            analyseEnCoursNumeric: {
              $cond: [
                { $eq: ["$nombreTransaction", 0] },
                0,
                { $multiply: [{ $divide: ["$analyzingCount", "$nombreTransaction"] }, 100] }
              ]
            }
          }
        },

        // Stage 8: Filter by minimum montant if specified
        ...(montant ? [{ $match: { montant: { $gte: montant } } }] : []),

        // Stage 9: Sort by date descending
        { $sort: { _id: -1 } },

        // Stage 10: Use $facet to get both count and paginated results in one query
        {
          $facet: {
            metadata: [{ $count: "total" }],
            data: [
              { $skip: (currentPage - 1) * itemsPerPage },
              { $limit: itemsPerPage }
            ]
          }
        }
      ];

      // Execute aggregation
      console.log("🚀 INTERNAL - Executing aggregation pipeline...");
      console.log("📋 Pipeline stages:", pipeline.length);
      console.log("📋 Full Pipeline:", JSON.stringify(pipeline, null, 2));

      const result = await client.transaction.aggregateRaw({ pipeline });

      console.log("✅ INTERNAL - Raw aggregation result:", JSON.stringify(result, null, 2));

      // Extract results
      // IMPORTANT: aggregateRaw returns an array, get first element
      const aggregationResult = (result as any)[0];
      const count = aggregationResult?.metadata?.[0]?.total || 0;
      const totalPages = Math.ceil(count / itemsPerPage);
      const dfcData = aggregationResult?.data || [];

      console.log("📈 INTERNAL - Extracted - Count:", count, "Total Pages:", totalPages, "DFC Data length:", dfcData.length);

      // Format results to match expected structure
      const formattedDfcs = dfcData.map((item: any) => ({
        id: `${item._id}_${society.id}`,
        date: new Date(item._id),
        montant: item.montant,
        nombreTransaction: item.nombreTransaction,
        societyId: society.id,
        sv2: item.sv2,
        sv3: item.sv3,
        tauxApprobation: `${Math.round((item.tauxApprobationNumeric ?? 0) * 100) / 100}%`,
        analyseEnCours: `${Math.round((item.analyseEnCoursNumeric ?? 0) * 100) / 100}%`,
        createdAt: new Date(),
        updatedAt: new Date(),
        details: item.details.map((detail: any) => ({
          ...detail,
          status: this.formatStatus(detail.statusNumeric),
          societyId: society.id,
          createdAt: new Date(),
          updatedAt: new Date()
        }))
      }));

      console.log("🔄 INTERNAL - Formatted DFCs:", formattedDfcs.length, "items");

      console.log("🎉 INTERNAL - Final record:", formattedDfcs.length, "items");
      console.log("📤 INTERNAL - Returning:", { recordLength: formattedDfcs.length, itemsPerPage, count, totalPages, currentPage });

      return { record: formattedDfcs, itemsPerPage, count, totalPages, currentPage };

    } else {
      // ===== EXTERNAL USER (Partner) - OPTIMIZED =====
      console.log("🔍 EXTERNAL USER - DFC AGGREGATION DEBUG");
      console.log("User:", user.email, "Partner ID:", user.partnerId);

      if (!user.partnerId) {
        console.log("❌ EXTERNAL - No partnerId found");
        return { record: [], itemsPerPage, count: 0, totalPages: 0, currentPage };
      }

      // Build match conditions
      // IMPORTANT: Use MongoDB Extended JSON format for ObjectId and Date
      const matchConditions: any = {
        societyId: { $oid: society.id },
        operateurId: { $oid: user.partnerId }
      };
      if (dateFrom) matchConditions.dateFlux = { $gte: { $date: new Date(dateFrom).toISOString() } };
      if (dateTo) matchConditions.dateFlux = { ...matchConditions.dateFlux, $lte: { $date: new Date(dateTo).toISOString() } };

      console.log("📊 EXTERNAL - Match Conditions:", JSON.stringify(matchConditions, null, 2));

      // Build aggregation pipeline for partner DFC
      const pipeline: any[] = [
        // Stage 1: Filter transactions
        { $match: matchConditions },

        // Stage 2: Add date-only field
        {
          $addFields: {
            dateOnly: {
              $dateToString: { format: "%Y-%m-%d", date: "$dateFlux", timezone: "UTC" }
            }
          }
        },

        // Stage 2b: Add status flags for percentage calculations
        {
          $addFields: {
            approvedFlag: { $cond: [{ $eq: ["$status", "Approved"] }, 1, 0] },
            analyzingFlag: { $cond: [{ $eq: ["$status", "Analyzing"] }, 1, 0] }
          }
        },

        // Stage 3: Group by date
        {
          $group: {
            _id: "$dateOnly",
            montant: { $sum: "$montant" },
            nombreTransaction: { $sum: 1 },
            sv2: { $sum: { $cond: [{ $eq: ["$source", "SV2"] }, 1, 0] } },
            sv3: { $sum: { $cond: [{ $eq: ["$source", "SV3"] }, 1, 0] } },
            statuses: { $push: "$status" },
            approvedCount: { $sum: "$approvedFlag" },
            analyzingCount: { $sum: "$analyzingFlag" }
          }
        },

        // Stage 4: Add computed status field
        {
          $addFields: {
            statusNumeric: {
              $cond: [
                { $allElementsTrue: [{ $map: { input: "$statuses", as: "s", in: { $eq: ["$$s", "Approved"] } } }] },
                1, // All approved
                {
                  $cond: [
                    { $in: ["Rejected", "$statuses"] },
                    2, // Has rejected
                    0  // Analyzing
                  ]
                }
              ]
            }
          }
        },

        // Stage 5: Filter by minimum montant if specified
        ...(montant ? [{ $match: { montant: { $gte: montant } } }] : []),

        // Stage 6: Sort by date descending
        { $sort: { _id: -1 } },

        // Stage 7: Use $facet for count + pagination
        {
          $facet: {
            metadata: [{ $count: "total" }],
            data: [
              { $skip: (currentPage - 1) * itemsPerPage },
              { $limit: itemsPerPage }
            ]
          }
        }
      ];

      // Execute aggregation
      console.log("🚀 EXTERNAL - Executing aggregation pipeline...");
      console.log("📋 EXTERNAL - Pipeline:", JSON.stringify(pipeline, null, 2));

      const result = await client.transaction.aggregateRaw({ pipeline });

      console.log("✅ EXTERNAL - Raw result:", JSON.stringify(result, null, 2));

      // Extract results
      // IMPORTANT: aggregateRaw returns an array, get first element
      const aggregationResult = (result as any)[0];
      const count = aggregationResult?.metadata?.[0]?.total || 0;
      const totalPages = Math.ceil(count / itemsPerPage);
      const dfcData = aggregationResult?.data || [];

      console.log("📈 EXTERNAL - Count:", count, "DFC Data length:", dfcData.length);

      // Format results
      const record = dfcData.map((item: any) => ({
        id: `${item._id}_${user.partnerId}_${society.id}`,
        date: new Date(item._id),
        montant: item.montant,
        nombreTransaction: item.nombreTransaction,
        message: null,
        source_account: null,
        destination_account: null,
        status: this.formatStatus(item.statusNumeric),
        tauxApprobation: `${Math.round((item.tauxApprobationNumeric ?? 0) * 100) / 100}%`,
        analyseEnCours: `${Math.round((item.analyseEnCoursNumeric ?? 0) * 100) / 100}%`,
        operateurId: user.partnerId,
        societyId: society.id,
        approvedBy: null,
        sv2: item.sv2,
        sv3: item.sv3,
        createdAt: new Date(),
        updatedAt: new Date(),
        approver: null
      }));

      console.log("🎉 EXTERNAL - Final record length:", record.length);
      console.log("📤 EXTERNAL - Returning:", { recordLength: record.length, itemsPerPage, count, totalPages, currentPage });

      return { record, itemsPerPage, count, totalPages, currentPage };
    }
  }
  async searchAll (
    societe: string,
    dateFrom?: string,
    dateTo?: string,
    partenaire?: string
  ) {
    const searchConditions: any = {
      AND: [
        dateFrom ? { date: { gte: new Date(dateFrom) } } : {},
        dateTo ? { date: { lte: new Date(dateTo) } } : {},
        { society: { name: societe.toUpperCase() } }
      ].filter((condition) => Object.keys(condition).length > 0),
    };

    const searchConditionsExt: any = {
      AND: [
        dateFrom ? { date: { gte: new Date(dateFrom) } } : {},
        dateTo ? { date: { lte: new Date(dateTo) } } : {},
        partenaire ? { operateurId: partenaire } : {},
        { society: { name: societe.toUpperCase() } }
      ].filter((condition) => Object.keys(condition).length > 0),
    };

    if (!partenaire) {
      const record = await client.resumeTransactionsJour.findMany({
        where: searchConditions,
        orderBy: { date: "desc" }
      });
      return { record };
    }
    else {
      const record = await client.resumeTransactionsOperateur.findMany({
        where: searchConditionsExt,
        orderBy: { date: "desc" }
      });
      return { record };
    }
  }
  async getDetailed (userData: { id: string, iat: number; }, RTid: string) {
    const user = await client.user.findUnique({ where: { id: userData.id }, include: { societies: { select: { name: true } } } });
    if (!user) {
      throw new Error("User not found");
    }

    if (user.type === "INTERNAL") {
      // Parse the ID: format is "YYYY-MM-DD_societyId" or "YYYY-MM-DD_operateurId"
      const parts = RTid.split('_');
      if (parts.length < 2) {
        // Fallback: try to find in old ResumeTransactionsJour (backward compatibility)
        const oldRes = await client.resumeTransactionsJour.findUnique({
          where: { id: RTid },
          include: { details: { include: { approver: { select: { email: true, firstname: true, lastname: true } }, operateur: { select: { id: true, name: true, status: true } }, source: true, destination: true } }, society: { select: { name: true } } }
        });
        if (oldRes) {
          const mapped = oldRes.details.map(detail => ({
            ...detail,
            status: this.formatStatus(detail.status)
          }));
          return {
            ...oldRes,
            nombreOperateurs: oldRes.details.length,
            tauxApprobation: await calculateApprob(oldRes.date),
            analyseEnCours: await calculateAnalysis(oldRes.date),
            details: mapped
          };
        }

        // Also try ResumeTransactionsOperateur (single operator detail)
        const oldOpRes = await client.resumeTransactionsOperateur.findUnique({
          where: { id: RTid },
          include: { operateur: { select: { id: true, name: true, status: true } } }
        });
        if (oldOpRes) {
          const source = oldOpRes.source_account ? await client.account.findFirst({ where: { id: oldOpRes.source_account } }) : null;
          const destination = oldOpRes.destination_account ? await client.account.findFirst({ where: { id: oldOpRes.destination_account } }) : null;
          return {
            ...oldOpRes,
            source,
            destination,
            status: this.formatStatus(oldOpRes.status)
          };
        }

        return null;
      }

      const dateStr = parts[0];
      const entityId = parts[1];
      const date = new Date(dateStr);
      const nextDay = new Date(date);
      nextDay.setDate(date.getDate() + 1);

      // Check if this is a society-level DFC or operator-level DFC
      const society = await client.society.findUnique({ where: { id: entityId } });

      if (society) {
        const matchConditions: any = {
          societyId: { $oid: society.id },
          dateFlux: {
            $gte: { $date: date.toISOString() },
            $lt: { $date: nextDay.toISOString() }
          }
        };

        const pipeline: any[] = [
          { $match: matchConditions },
          {
            $addFields: {
              approvedFlag: { $cond: [{ $eq: ["$status", "Approved"] }, 1, 0] },
              analyzingFlag: { $cond: [{ $eq: ["$status", "Analyzing"] }, 1, 0] }
            }
          },
          {
            $lookup: {
              from: "Partner",
              localField: "operateurId",
              foreignField: "_id",
              as: "operateur"
            }
          },
          { $unwind: "$operateur" },
          {
            $group: {
              _id: "$operateurId",
              montant: { $sum: "$montant" },
              nombreTransaction: { $sum: 1 },
              sv2: { $sum: { $cond: [{ $eq: ["$source", "SV2"] }, 1, 0] } },
              sv3: { $sum: { $cond: [{ $eq: ["$source", "SV3"] }, 1, 0] } },
              statuses: { $push: "$status" },
              approvedCount: { $sum: "$approvedFlag" },
              analyzingCount: { $sum: "$analyzingFlag" },
              operateur: { $first: { id: "$operateur._id", name: "$operateur.name", status: "$operateur.status" } }
            }
          },
          {
            $addFields: {
              statusNumeric: {
                $cond: [
                  { $allElementsTrue: [{ $map: { input: "$statuses", as: "s", in: { $eq: ["$$s", "Approved"] } } }] },
                  1,
                  {
                    $cond: [
                      { $in: ["Rejected", "$statuses"] },
                      2,
                      0
                    ]
                  }
                ]
              }
            }
          },
          {
            $group: {
              _id: null,
              montant: { $sum: "$montant" },
              nombreTransaction: { $sum: "$nombreTransaction" },
              sv2: { $sum: "$sv2" },
              sv3: { $sum: "$sv3" },
              approvedCount: { $sum: "$approvedCount" },
              analyzingCount: { $sum: "$analyzingCount" },
              details: {
                $push: {
                  operateurId: "$_id",
                  operateur: "$operateur",
                  montant: "$montant",
                  nombreTransaction: "$nombreTransaction",
                  sv2: "$sv2",
                  sv3: "$sv3",
                  statusNumeric: "$statusNumeric"
                }
              }
            }
          },
          {
            $addFields: {
              tauxApprobationNumeric: {
                $cond: [
                  { $eq: ["$nombreTransaction", 0] },
                  0,
                  { $multiply: [{ $divide: ["$approvedCount", "$nombreTransaction"] }, 100] }
                ]
              },
              analyseEnCoursNumeric: {
                $cond: [
                  { $eq: ["$nombreTransaction", 0] },
                  0,
                  { $multiply: [{ $divide: ["$analyzingCount", "$nombreTransaction"] }, 100] }
                ]
              }
            }
          }
        ];

        const aggResult = await client.transaction.aggregateRaw({ pipeline });
        const dayAgg = (aggResult as any)?.[0];

        if (!dayAgg) {
          return null;
        }

        const details = (dayAgg.details || []).map((d: any) => ({
          id: `${dateStr}_${d.operateurId}`,
          operateur: d.operateur,
          nombreTransaction: d.nombreTransaction,
          montant: d.montant,
          sv2: d.sv2,
          sv3: d.sv3,
          dfcId: RTid,
          approbation: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          approver: null,
          source: null,
          destination: null,
          status: this.formatStatus(d.statusNumeric)
        }));

        return {
          id: RTid,
          date: date,
          montant: dayAgg.montant,
          nombreTransaction: dayAgg.nombreTransaction,
          societyId: society.id,
          societe: society.name,
          sv2: dayAgg.sv2,
          sv3: dayAgg.sv3,
          createdAt: new Date(),
          updatedAt: new Date(),
          nombreOperateurs: details.length,
          tauxApprobation: `${Math.round((dayAgg.tauxApprobationNumeric ?? 0) * 100) / 100}%`,
          analyseEnCours: `${Math.round((dayAgg.analyseEnCoursNumeric ?? 0) * 100) / 100}%`,
          details: details
        };
      } else {
        // Operator-level DFC: check if entityId is an operator
        const operateur = await client.partner.findUnique({ where: { id: entityId }, select: { id: true, name: true, status: true } });
        if (!operateur) {
          return null;
        }

        // Get transactions for this operator and date
        const transactions = await client.transaction.findMany({
          where: {
            dateFlux: {
              gte: date,
              lt: nextDay
            },
            operateurId: operateur.id
          }
        });

        if (transactions.length === 0) {
          return null;
        }

        const montantTotal = transactions.reduce((sum, t) => sum + t.montant, 0);
        const nombreTransaction = transactions.length;
        const sv2 = transactions.filter(t => t.source === 'SV2').length;
        const sv3 = transactions.filter(t => t.source === 'SV3').length;

        // Calculate status
        const hasAnalyzing = transactions.some(t => t.status === TransactionStatus.Analyzing);
        const hasRejected = transactions.some(t => t.status === TransactionStatus.Rejected);
        const allApproved = transactions.every(t => t.status === TransactionStatus.Approved);

        let statusNumeric = 0;
        if (allApproved) statusNumeric = 1;
        else if (hasRejected) statusNumeric = 2;

        // Retrieve approval metadata if exists
        const societyId = transactions[0]?.societyId;
        const approvalMetadata = societyId ? await client.dfcApproval.findUnique({
          where: {
            operateurId_date_societyId: {
              operateurId: operateur.id,
              date: date,
              societyId: societyId
            }
          }
        }) : null;

        return {
          id: RTid,
          date: date,
          montant: montantTotal,
          nombreTransaction: nombreTransaction,
          operateurId: operateur.id,
          operateur: operateur,
          societyId: transactions[0]?.societyId || null,
          sv2: sv2,
          sv3: sv3,
          message: approvalMetadata?.message || null,
          source_account: approvalMetadata?.source_account || null,
          destination_account: approvalMetadata?.destination_account || null,
          source: null,
          destination: null,
          approvedBy: approvalMetadata?.approvedBy || null,
          createdAt: new Date(),
          updatedAt: new Date(),
          status: this.formatStatus(statusNumeric)
        };
      }
    }

    if (user.type === "EXTERNAL") {
      // Parse ID for external user
      const parts = RTid.split('_');
      if (parts.length < 3) {
        // Backward compatibility: try old ResumeTransactionsOperateur
        const oldMoon = await client.resumeTransactionsOperateur.findUnique({
          where: { id: RTid },
          include: { approver: { select: { firstname: true, lastname: true } }, society: { select: { name: true } } }
        });
        if (oldMoon) {
          return {
            ...oldMoon,
            status: this.formatStatus(oldMoon.status)
          };
        }
        return null;
      }

      const dateStr = parts[0];
      const operateurId = parts[1];
      const societyId = parts[2];
      const date = new Date(dateStr);
      const nextDay = new Date(date);
      nextDay.setDate(date.getDate() + 1);

      // Get transactions
      const transactions = await client.transaction.findMany({
        where: {
          dateFlux: {
            gte: date,
            lt: nextDay
          },
          operateurId: operateurId,
          societyId: societyId
        }
      });

      if (transactions.length === 0) {
        return null;
      }

      const montantTotal = transactions.reduce((sum, t) => sum + t.montant, 0);
      const nombreTransaction = transactions.length;
      const sv2 = transactions.filter(t => t.source === 'SV2').length;
      const sv3 = transactions.filter(t => t.source === 'SV3').length;

      // Calculate status
      const hasAnalyzing = transactions.some(t => t.status === TransactionStatus.Analyzing);
      const hasRejected = transactions.some(t => t.status === TransactionStatus.Rejected);
      const allApproved = transactions.every(t => t.status === TransactionStatus.Approved);

      let statusNumeric = 0;
      if (allApproved) statusNumeric = 1;
      else if (hasRejected) statusNumeric = 2;

      const society = await client.society.findUnique({ where: { id: societyId }, select: { name: true } });

      // Retrieve approval metadata if exists
      const approvalMetadata = await client.dfcApproval.findUnique({
        where: {
          operateurId_date_societyId: {
            operateurId: operateurId,
            date: date,
            societyId: societyId
          }
        }
      });

      return {
        id: RTid,
        date: date,
        montant: montantTotal,
        nombreTransaction: nombreTransaction,
        message: approvalMetadata?.message || null,
        source_account: approvalMetadata?.source_account || null,
        destination_account: approvalMetadata?.destination_account || null,
        status: this.formatStatus(statusNumeric),
        operateurId: operateurId,
        societyId: societyId,
        approvedBy: approvalMetadata?.approvedBy || null,
        sv2: sv2,
        sv3: sv3,
        society: society,
        approver: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    throw new Error("User Type is invalid!");
  }
  async approveDfc (id: string, approval: boolean, content: { source?: string, destination?: string, message?: string; }, userData: { id: string, iat: number; }) {
    // Parse the ID to get date, operateurId, societyId
    const parts = id.split('_');

    // Try to parse synthetic ID (format: YYYY-MM-DD_operateurId_societyId or YYYY-MM-DD_operateurId)
    let date: Date;
    let operateurId: string;
    let societyId: string | null = null;

    if (parts.length >= 2 && parts[0].match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Synthetic ID
      date = new Date(parts[0]);
      operateurId = parts[1];
      if (parts.length >= 3) {
        societyId = parts[2];
      }
    } else {
      // Backward compatibility: try to find in old ResumeTransactionsOperateur
      const oldDfc = await client.resumeTransactionsOperateur.findUnique({ where: { id } });
      if (!oldDfc) {
        throw new Error("DFC not found");
      }
      date = oldDfc.date;
      operateurId = oldDfc.operateurId;
      societyId = oldDfc.societyId;
    }

    // Update all transactions for this date and operator
    const nextDay = new Date(date);
    nextDay.setDate(date.getDate() + 1);

    const updateConditions: any = {
      dateFlux: {
        gte: date,
        lt: nextDay
      },
      operateurId: operateurId
    };

    if (societyId) {
      updateConditions.societyId = societyId;
    }

    await client.transaction.updateMany({
      where: updateConditions,
      data: {
        status: approval ? TransactionStatus.Approved : TransactionStatus.Rejected,
      },
    });

    // Fetch updated transactions to get societyId if not provided
    const updatedTransactions = await client.transaction.findMany({
      where: updateConditions,
      take: 1
    });
    const finalSocietyId = societyId || updatedTransactions[0]?.societyId || null;

    // Persist approval metadata in DfcApproval collection (only if societyId exists)
    if (finalSocietyId) {
      await client.dfcApproval.upsert({
        where: {
          operateurId_date_societyId: {
            operateurId: operateurId,
            date: date,
            societyId: finalSocietyId
          }
        },
        create: {
          operateurId: operateurId,
          date: date,
          societyId: finalSocietyId,
          approvedBy: userData.id,
          approval: approval,
          source_account: approval ? content.source : null,
          destination_account: approval ? content.destination : null,
          message: !approval ? content.message : null
        },
        update: {
          approvedBy: userData.id,
          approval: approval,
          source_account: approval ? content.source : null,
          destination_account: approval ? content.destination : null,
          message: !approval ? content.message : null,
          updatedAt: new Date()
        }
      });
    }

    // Aggregate updated transactions to recalculate DFC in real-time (avoid full read)
    const matchConditions: any = {
      operateurId: { $oid: operateurId },
      dateFlux: {
        $gte: { $date: date.toISOString() },
        $lt: { $date: nextDay.toISOString() }
      }
    };
    if (finalSocietyId) {
      matchConditions.societyId = { $oid: finalSocietyId };
    }

    const pipeline: any[] = [
      { $match: matchConditions },
      {
        $addFields: {
          approvedFlag: { $cond: [{ $eq: ["$status", "Approved"] }, 1, 0] },
          analyzingFlag: { $cond: [{ $eq: ["$status", "Analyzing"] }, 1, 0] },
          rejectedFlag: { $cond: [{ $eq: ["$status", "Rejected"] }, 1, 0] },
          sv2Flag: { $cond: [{ $eq: ["$source", "SV2"] }, 1, 0] },
          sv3Flag: { $cond: [{ $eq: ["$source", "SV3"] }, 1, 0] }
        }
      },
      {
        $group: {
          _id: null,
          montant: { $sum: "$montant" },
          nombreTransaction: { $sum: 1 },
          sv2: { $sum: "$sv2Flag" },
          sv3: { $sum: "$sv3Flag" },
          approvedCount: { $sum: "$approvedFlag" },
          analyzingCount: { $sum: "$analyzingFlag" },
          rejectedCount: { $sum: "$rejectedFlag" }
        }
      }
    ];

    const aggResult = await client.transaction.aggregateRaw({ pipeline });
    const dayAgg = (aggResult as any)?.[0];

    if (!dayAgg || !dayAgg.nombreTransaction) {
      throw new Error("No transactions found for this DFC");
    }

    let statusNumeric = 0; // En cours
    if ((dayAgg.rejectedCount ?? 0) > 0) statusNumeric = 2; // Rejeté
    else if ((dayAgg.analyzingCount ?? 0) > 0) statusNumeric = 0; // En cours
    else statusNumeric = 1; // Approuvé

    // Return the calculated DFC (no database update needed for DFC collection)
    return {
      id: id,
      date: date,
      montant: dayAgg.montant,
      nombreTransaction: dayAgg.nombreTransaction,
      message: content.message || null,
      source_account: content.source || null,
      destination_account: content.destination || null,
      status: statusNumeric,
      operateurId: operateurId,
      societyId: finalSocietyId,
      approvedBy: userData.id,
      sv2: dayAgg.sv2,
      sv3: dayAgg.sv3,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  };
  async cleanup () {
    await client.resumeTransactionsJour.deleteMany({
      where: {
        nombreTransaction: 0
      }
    }).then(async () => {
      await client.resumeTransactionsOperateur.deleteMany({
        where: {
          nombreTransaction: 0
        }
      });
    })
      .then(() => {
        console.log("Transactions cleaned up successfully!");
      });
  }
}

export default new Repository();

// establishStatus() function removed - status is now stored in the database
// and calculated during DFC creation/update to eliminate N+1 query problems
async function calculateApprob (date: Date): Promise<string> {
  const followingDay = new Date(date);
  followingDay.setDate(date.getDate() + 1);
  const transactions = await client.transaction.findMany({
    where: {
      // operateurId,
      dateFlux: {
        gte: date,
        lt: followingDay
      }
    }
  });
  const statuses = transactions.map(
    t => t.status
  );
  const okays = statuses.reduce((sum, transaction) => sum + (transaction == TransactionStatus.Approved ? 1 : 0), 0);
  // const loading = statuses.reduce((sum, transaction) => sum + (transaction == TransactionStatus.Analyzing ? 1 : 0), 0)
  // const nopes = statuses.reduce((sum, transaction) => sum + (transaction == TransactionStatus.Rejected ? 1 : 0), 0)

  // Avoid division by zero
  if (statuses.length === 0) return "0%";

  const result = Math.round((okays / statuses.length) * 10000) / 100;

  return `${result}%`;
}

async function calculateAnalysis (date: Date): Promise<string> {
  const followingDay = new Date(date);
  followingDay.setDate(date.getDate() + 1);
  const transactions = await client.transaction.findMany({
    where: {
      // operateurId,
      dateFlux: {
        gte: date,
        lt: followingDay
      }
    }
  });
  const statuses = transactions.map(
    t => t.status
  );
  // const okays = statuses.reduce((sum, transaction) => sum + (transaction == TransactionStatus.Approved ? 1 : 0), 0);
  const loading = statuses.reduce((sum, transaction) => sum + (transaction == TransactionStatus.Analyzing ? 1 : 0), 0);
  // const nopes = statuses.reduce((sum, transaction) => sum + (transaction == TransactionStatus.Rejected ? 1 : 0), 0);

  // Avoid division by zero
  if (statuses.length === 0) return "0%";

  const result = Math.round((loading / statuses.length) * 10000) / 100;
  return `${result}%`;
}

