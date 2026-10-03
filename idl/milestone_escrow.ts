/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/milestone_escrow.json`.
 */
export type MilestoneEscrow = {
  "address": "A8JXDe5Fy9fvBGMZoQhzEbTF8KVpiwtvnQYJHkzM4Qer",
  "metadata": {
    "name": "milestoneEscrow",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Milestone escrow with silence-pays release and a three-arbiter panel"
  },
  "instructions": [
    {
      "name": "acceptDeal",
      "discriminator": [
        76,
        156,
        34,
        30,
        129,
        136,
        76,
        244
      ],
      "accounts": [
        {
          "name": "worker",
          "signer": true,
          "relations": [
            "deal"
          ]
        },
        {
          "name": "deal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "deal.client",
                "account": "deal"
              },
              {
                "kind": "account",
                "path": "deal.dealId",
                "account": "deal"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "approveMilestone",
      "discriminator": [
        145,
        85,
        92,
        60,
        50,
        130,
        219,
        106
      ],
      "accounts": [
        {
          "name": "client",
          "signer": true,
          "relations": [
            "deal"
          ]
        },
        {
          "name": "deal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "deal.client",
                "account": "deal"
              },
              {
                "kind": "account",
                "path": "deal.dealId",
                "account": "deal"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u8"
        }
      ]
    },
    {
      "name": "cancelDeal",
      "discriminator": [
        158,
        86,
        193,
        45,
        168,
        111,
        48,
        29
      ],
      "accounts": [
        {
          "name": "signer",
          "signer": true
        },
        {
          "name": "deal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "deal.client",
                "account": "deal"
              },
              {
                "kind": "account",
                "path": "deal.dealId",
                "account": "deal"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "agree",
          "type": "bool"
        }
      ]
    },
    {
      "name": "castVote",
      "discriminator": [
        20,
        212,
        15,
        189,
        69,
        180,
        69,
        151
      ],
      "accounts": [
        {
          "name": "judge",
          "signer": true
        },
        {
          "name": "deal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "deal.client",
                "account": "deal"
              },
              {
                "kind": "account",
                "path": "deal.dealId",
                "account": "deal"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u8"
        },
        {
          "name": "side",
          "type": {
            "defined": {
              "name": "side"
            }
          }
        }
      ]
    },
    {
      "name": "closeDeal",
      "discriminator": [
        157,
        173,
        33,
        216,
        146,
        16,
        65,
        82
      ],
      "accounts": [
        {
          "name": "cranker",
          "docs": [
            "Anyone. Pays the fee, receives nothing."
          ],
          "signer": true
        },
        {
          "name": "deal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "deal.client",
                "account": "deal"
              },
              {
                "kind": "account",
                "path": "deal.dealId",
                "account": "deal"
              }
            ]
          }
        },
        {
          "name": "client",
          "docs": [
            "deal's client by the `address` constraint."
          ],
          "writable": true
        },
        {
          "name": "mint"
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "deal"
              }
            ]
          }
        },
        {
          "name": "clientToken",
          "docs": [
            "Receives anything left in the vault (tokens someone sent there",
            "directly). Required only if the vault is not empty."
          ],
          "writable": true,
          "optional": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "createDeal",
      "discriminator": [
        198,
        212,
        144,
        151,
        97,
        56,
        149,
        113
      ],
      "accounts": [
        {
          "name": "client",
          "writable": true,
          "signer": true
        },
        {
          "name": "deal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "client"
              },
              {
                "kind": "arg",
                "path": "args.dealId"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "vault",
          "docs": [
            "Owned by the deal PDA, so only this program can move the escrow out."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "deal"
              }
            ]
          }
        },
        {
          "name": "clientToken",
          "docs": [
            "Where the escrow comes from; must belong to the signing client."
          ],
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "createDealArgs"
            }
          }
        }
      ]
    },
    {
      "name": "openDispute",
      "discriminator": [
        137,
        25,
        99,
        119,
        23,
        223,
        161,
        42
      ],
      "accounts": [
        {
          "name": "client",
          "signer": true,
          "relations": [
            "deal"
          ]
        },
        {
          "name": "deal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "deal.client",
                "account": "deal"
              },
              {
                "kind": "account",
                "path": "deal.dealId",
                "account": "deal"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "deal"
              }
            ]
          }
        },
        {
          "name": "clientToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u8"
        }
      ]
    },
    {
      "name": "setProofTarget",
      "discriminator": [
        253,
        77,
        89,
        46,
        233,
        162,
        13,
        241
      ],
      "accounts": [
        {
          "name": "client",
          "signer": true,
          "relations": [
            "deal"
          ]
        },
        {
          "name": "deal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "deal.client",
                "account": "deal"
              },
              {
                "kind": "account",
                "path": "deal.dealId",
                "account": "deal"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u8"
        },
        {
          "name": "proofKind",
          "type": {
            "defined": {
              "name": "proofKind"
            }
          }
        },
        {
          "name": "proofRef",
          "type": "u32"
        }
      ]
    },
    {
      "name": "settleMilestone",
      "discriminator": [
        0,
        239,
        52,
        170,
        175,
        209,
        205,
        224
      ],
      "accounts": [
        {
          "name": "cranker",
          "docs": [
            "Anyone. Pays the fee, receives nothing."
          ],
          "signer": true
        },
        {
          "name": "deal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "deal.client",
                "account": "deal"
              },
              {
                "kind": "account",
                "path": "deal.dealId",
                "account": "deal"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "deal"
              }
            ]
          }
        },
        {
          "name": "workerToken",
          "docs": [
            "Any token account of the deal's mint owned by the worker. Required only",
            "when the worker receives something."
          ],
          "writable": true,
          "optional": true
        },
        {
          "name": "clientToken",
          "docs": [
            "Any token account of the deal's mint owned by the client. Required only",
            "when the client receives something."
          ],
          "writable": true,
          "optional": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u8"
        }
      ]
    },
    {
      "name": "submitProof",
      "discriminator": [
        54,
        241,
        46,
        84,
        4,
        212,
        46,
        94
      ],
      "accounts": [
        {
          "name": "submitter",
          "docs": [
            "Anyone. Pays the fee, receives nothing."
          ],
          "signer": true
        },
        {
          "name": "deal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "deal.client",
                "account": "deal"
              },
              {
                "kind": "account",
                "path": "deal.dealId",
                "account": "deal"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u8"
        },
        {
          "name": "proof",
          "type": {
            "defined": {
              "name": "proofArgs"
            }
          }
        }
      ]
    },
    {
      "name": "submitWork",
      "discriminator": [
        158,
        80,
        101,
        51,
        114,
        130,
        101,
        253
      ],
      "accounts": [
        {
          "name": "worker",
          "signer": true,
          "relations": [
            "deal"
          ]
        },
        {
          "name": "deal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "deal.client",
                "account": "deal"
              },
              {
                "kind": "account",
                "path": "deal.dealId",
                "account": "deal"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u8"
        },
        {
          "name": "deliverableHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "uri",
          "type": "string"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "deal",
      "discriminator": [
        125,
        223,
        160,
        234,
        71,
        162,
        182,
        219
      ]
    }
  ],
  "events": [
    {
      "name": "cancelRequested",
      "discriminator": [
        178,
        234,
        154,
        172,
        145,
        115,
        28,
        116
      ]
    },
    {
      "name": "dealAccepted",
      "discriminator": [
        46,
        237,
        221,
        106,
        204,
        225,
        94,
        36
      ]
    },
    {
      "name": "dealCancelled",
      "discriminator": [
        229,
        189,
        86,
        176,
        134,
        151,
        43,
        152
      ]
    },
    {
      "name": "dealClosed",
      "discriminator": [
        38,
        112,
        214,
        184,
        107,
        76,
        191,
        175
      ]
    },
    {
      "name": "dealCreated",
      "discriminator": [
        27,
        18,
        50,
        52,
        104,
        175,
        46,
        101
      ]
    },
    {
      "name": "disputeOpened",
      "discriminator": [
        239,
        222,
        102,
        235,
        193,
        85,
        1,
        214
      ]
    },
    {
      "name": "milestoneApproved",
      "discriminator": [
        40,
        109,
        159,
        144,
        169,
        230,
        35,
        229
      ]
    },
    {
      "name": "milestoneSettled",
      "discriminator": [
        14,
        243,
        90,
        90,
        207,
        201,
        235,
        116
      ]
    },
    {
      "name": "proofTargetSet",
      "discriminator": [
        200,
        130,
        106,
        165,
        170,
        93,
        121,
        12
      ]
    },
    {
      "name": "proofVerified",
      "discriminator": [
        181,
        54,
        148,
        211,
        237,
        73,
        131,
        232
      ]
    },
    {
      "name": "voteCast",
      "discriminator": [
        39,
        53,
        195,
        104,
        188,
        17,
        225,
        213
      ]
    },
    {
      "name": "workSubmitted",
      "discriminator": [
        136,
        185,
        210,
        174,
        216,
        140,
        64,
        125
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidMilestoneCount",
      "msg": "A deal needs between 1 and 5 milestones"
    },
    {
      "code": 6001,
      "name": "zeroAmount",
      "msg": "Every milestone amount must be greater than zero"
    },
    {
      "code": 6002,
      "name": "windowOutOfBounds",
      "msg": "A time window is shorter than the minimum or longer than one year"
    },
    {
      "code": 6003,
      "name": "duplicateParty",
      "msg": "Client, worker and arbiters must all be different people"
    },
    {
      "code": 6004,
      "name": "invalidRepo",
      "msg": "The repository must look like owner/name"
    },
    {
      "code": 6005,
      "name": "invalidProofTarget",
      "msg": "The proof settings for this milestone are not valid"
    },
    {
      "code": 6006,
      "name": "duplicateProofTarget",
      "msg": "This pull request is already linked to another milestone"
    },
    {
      "code": 6007,
      "name": "mathOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6008,
      "name": "notClient",
      "msg": "Only the client can do this"
    },
    {
      "code": 6009,
      "name": "notWorker",
      "msg": "Only the freelancer can do this"
    },
    {
      "code": 6010,
      "name": "notJudge",
      "msg": "Only one of the deal's arbiters can vote"
    },
    {
      "code": 6011,
      "name": "notParty",
      "msg": "Only the client or the freelancer can do this"
    },
    {
      "code": 6012,
      "name": "dealNotOpen",
      "msg": "The deal is not waiting for acceptance"
    },
    {
      "code": 6013,
      "name": "dealNotActive",
      "msg": "The deal is not active"
    },
    {
      "code": 6014,
      "name": "dealNotCancellable",
      "msg": "The deal can no longer be cancelled"
    },
    {
      "code": 6015,
      "name": "invalidCancelArgument",
      "msg": "A deal that was never accepted can only be cancelled, not un-cancelled"
    },
    {
      "code": 6016,
      "name": "acceptWindowClosed",
      "msg": "The time to accept this deal is over"
    },
    {
      "code": 6017,
      "name": "invalidMilestoneIndex",
      "msg": "There is no milestone with this number"
    },
    {
      "code": 6018,
      "name": "invalidMilestoneStatus",
      "msg": "The milestone is not in the right state for this"
    },
    {
      "code": 6019,
      "name": "submitWindowClosed",
      "msg": "The delivery deadline for this milestone has passed"
    },
    {
      "code": 6020,
      "name": "reviewWindowClosed",
      "msg": "The review time is over. You can no longer object"
    },
    {
      "code": 6021,
      "name": "voteWindowClosed",
      "msg": "The voting time is over"
    },
    {
      "code": 6022,
      "name": "alreadyVoted",
      "msg": "This arbiter has already voted"
    },
    {
      "code": 6023,
      "name": "alreadyDecided",
      "msg": "The arbiters have already decided this milestone"
    },
    {
      "code": 6024,
      "name": "uriTooLong",
      "msg": "The deliverable link is too long"
    },
    {
      "code": 6025,
      "name": "proofTargetAlreadySet",
      "msg": "A pull request is already linked to this milestone"
    },
    {
      "code": 6026,
      "name": "noProofTarget",
      "msg": "This milestone has no proof condition"
    },
    {
      "code": 6027,
      "name": "proofMalformed",
      "msg": "The proof is malformed"
    },
    {
      "code": 6028,
      "name": "proofIdentifierMismatch",
      "msg": "The proof is not about the agreed pull request"
    },
    {
      "code": 6029,
      "name": "proofContextMismatch",
      "msg": "The proof was made for a different deal or milestone"
    },
    {
      "code": 6030,
      "name": "proofSignatureInvalid",
      "msg": "The proof signature is invalid"
    },
    {
      "code": 6031,
      "name": "proofAttestorMismatch",
      "msg": "The proof was not signed by the agreed attestor"
    },
    {
      "code": 6032,
      "name": "alreadySettled",
      "msg": "This milestone has already been paid out"
    },
    {
      "code": 6033,
      "name": "nothingToSettle",
      "msg": "Nothing to pay out yet"
    },
    {
      "code": 6034,
      "name": "missingRecipientAccount",
      "msg": "A token account for the recipient is required"
    },
    {
      "code": 6035,
      "name": "dealNotFullySettled",
      "msg": "Every milestone must be paid out before the deal can be closed"
    }
  ],
  "types": [
    {
      "name": "cancelRequested",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "deal",
            "type": "pubkey"
          },
          {
            "name": "by",
            "type": "pubkey"
          },
          {
            "name": "agree",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "createDealArgs",
      "docs": [
        "Everything the client fixes when creating a deal. None of it can change",
        "afterwards, except a one-time pull request binding (`set_proof_target`)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "dealId",
            "type": "u64"
          },
          {
            "name": "worker",
            "type": "pubkey"
          },
          {
            "name": "judges",
            "type": {
              "array": [
                "pubkey",
                3
              ]
            }
          },
          {
            "name": "acceptWindowSecs",
            "type": "u32"
          },
          {
            "name": "reviewWindowSecs",
            "type": "u32"
          },
          {
            "name": "voteWindowSecs",
            "type": "u32"
          },
          {
            "name": "disputeDeposit",
            "type": "u64"
          },
          {
            "name": "proofAttestor",
            "type": {
              "array": [
                "u8",
                20
              ]
            }
          },
          {
            "name": "proofRepo",
            "type": "string"
          },
          {
            "name": "milestones",
            "type": {
              "vec": {
                "defined": {
                  "name": "milestoneInput"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "deal",
      "docs": [
        "One deal between a client and a freelancer.",
        "",
        "The header fields up to `proof_repo` have fixed offsets (noted on each",
        "field) so clients can filter deals by party with `memcmp`. Never put an",
        "`Option`, `Vec` or `String` before `proof_repo`.",
        "",
        "The account is also the authority of the vault token account, so escrowed",
        "tokens can only move in a transaction this program signs for."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "client",
            "docs": [
              "offset 8"
            ],
            "type": "pubkey"
          },
          {
            "name": "worker",
            "docs": [
              "offset 40"
            ],
            "type": "pubkey"
          },
          {
            "name": "judges",
            "docs": [
              "offsets 72, 104, 136: client's pick, worker's pick, mutually agreed."
            ],
            "type": {
              "array": [
                "pubkey",
                3
              ]
            }
          },
          {
            "name": "mint",
            "docs": [
              "offset 168"
            ],
            "type": "pubkey"
          },
          {
            "name": "dealId",
            "docs": [
              "offset 200"
            ],
            "type": "u64"
          },
          {
            "name": "status",
            "docs": [
              "offset 208"
            ],
            "type": {
              "defined": {
                "name": "dealStatus"
              }
            }
          },
          {
            "name": "bump",
            "docs": [
              "offset 209"
            ],
            "type": "u8"
          },
          {
            "name": "vaultBump",
            "docs": [
              "offset 210"
            ],
            "type": "u8"
          },
          {
            "name": "cancelFlags",
            "docs": [
              "offset 211: `CANCEL_FLAG_CLIENT | CANCEL_FLAG_WORKER`."
            ],
            "type": "u8"
          },
          {
            "name": "settledCount",
            "docs": [
              "offset 212"
            ],
            "type": "u8"
          },
          {
            "name": "createdAt",
            "docs": [
              "offset 213"
            ],
            "type": "i64"
          },
          {
            "name": "acceptDeadline",
            "docs": [
              "offset 221"
            ],
            "type": "i64"
          },
          {
            "name": "acceptedAt",
            "docs": [
              "offset 229 (0 until accepted)"
            ],
            "type": "i64"
          },
          {
            "name": "reviewWindowSecs",
            "docs": [
              "offset 237"
            ],
            "type": "u32"
          },
          {
            "name": "voteWindowSecs",
            "docs": [
              "offset 241"
            ],
            "type": "u32"
          },
          {
            "name": "disputeDeposit",
            "docs": [
              "offset 245"
            ],
            "type": "u64"
          },
          {
            "name": "proofAttestor",
            "docs": [
              "offset 253: Ethereum-style address of the attestor both parties accept",
              "for proofs. All zero disables proofs."
            ],
            "type": {
              "array": [
                "u8",
                20
              ]
            }
          },
          {
            "name": "reserved",
            "docs": [
              "offset 273"
            ],
            "type": {
              "array": [
                "u8",
                12
              ]
            }
          },
          {
            "name": "proofRepo",
            "docs": [
              "offset 285: `\"owner/name\"` or empty."
            ],
            "type": "string"
          },
          {
            "name": "milestones",
            "type": {
              "vec": {
                "defined": {
                  "name": "milestone"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "dealAccepted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "deal",
            "type": "pubkey"
          },
          {
            "name": "acceptedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "dealCancelled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "deal",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "dealClosed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "deal",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "dealCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "deal",
            "type": "pubkey"
          },
          {
            "name": "client",
            "type": "pubkey"
          },
          {
            "name": "worker",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "total",
            "type": "u64"
          },
          {
            "name": "milestoneCount",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "dealStatus",
      "docs": [
        "Lifecycle of a whole deal."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "open"
          },
          {
            "name": "active"
          },
          {
            "name": "cancelled"
          }
        ]
      }
    },
    {
      "name": "disputeOpened",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "deal",
            "type": "pubkey"
          },
          {
            "name": "index",
            "type": "u8"
          },
          {
            "name": "deposit",
            "type": "u64"
          },
          {
            "name": "voteDeadline",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "milestone",
      "docs": [
        "One payable piece of work inside a deal."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "milestoneStatus"
              }
            }
          },
          {
            "name": "outcome",
            "type": {
              "defined": {
                "name": "outcome"
              }
            }
          },
          {
            "name": "proofKind",
            "type": {
              "defined": {
                "name": "proofKind"
              }
            }
          },
          {
            "name": "votes",
            "docs": [
              "Index-aligned with `Deal::judges`; `VOTE_NONE`, `VOTE_WORKER`, `VOTE_CLIENT`."
            ],
            "type": {
              "array": [
                "u8",
                3
              ]
            }
          },
          {
            "name": "proofRef",
            "docs": [
              "Pull request number (0 = none)."
            ],
            "type": "u32"
          },
          {
            "name": "dueSecs",
            "docs": [
              "Delivery deadline, relative to acceptance."
            ],
            "type": "u32"
          },
          {
            "name": "submitDeadline",
            "type": "i64"
          },
          {
            "name": "submittedAt",
            "type": "i64"
          },
          {
            "name": "reviewDeadline",
            "type": "i64"
          },
          {
            "name": "voteDeadline",
            "type": "i64"
          },
          {
            "name": "depositLocked",
            "type": "u64"
          },
          {
            "name": "deliverableHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "milestoneApproved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "deal",
            "type": "pubkey"
          },
          {
            "name": "index",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "milestoneInput",
      "docs": [
        "Terms of one milestone as proposed by the client."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "dueSecs",
            "type": "u32"
          },
          {
            "name": "proofKind",
            "type": {
              "defined": {
                "name": "proofKind"
              }
            }
          },
          {
            "name": "proofRef",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "milestoneSettled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "deal",
            "type": "pubkey"
          },
          {
            "name": "index",
            "type": "u8"
          },
          {
            "name": "outcome",
            "type": {
              "defined": {
                "name": "outcome"
              }
            }
          },
          {
            "name": "toWorker",
            "type": "u64"
          },
          {
            "name": "toClient",
            "type": "u64"
          },
          {
            "name": "cranker",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "milestoneStatus",
      "docs": [
        "Lifecycle of one milestone."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "pending"
          },
          {
            "name": "submitted"
          },
          {
            "name": "disputed"
          },
          {
            "name": "approved"
          },
          {
            "name": "settled"
          }
        ]
      }
    },
    {
      "name": "outcome",
      "docs": [
        "How a settled milestone was paid out."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "unset"
          },
          {
            "name": "workerPaid"
          },
          {
            "name": "clientRefunded"
          },
          {
            "name": "split"
          },
          {
            "name": "cancelled"
          }
        ]
      }
    },
    {
      "name": "proofArgs",
      "docs": [
        "A signed attestation, exactly as produced by the attestor."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "context",
            "docs": [
              "The signed context JSON, byte for byte. At most 512 bytes."
            ],
            "type": "string"
          },
          {
            "name": "identifier",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "owner",
            "docs": [
              "`\"0x\"` + 40 lowercase hex characters, as signed."
            ],
            "type": "string"
          },
          {
            "name": "timestampS",
            "type": "u32"
          },
          {
            "name": "epoch",
            "type": "u32"
          },
          {
            "name": "signature",
            "docs": [
              "r || s || v"
            ],
            "type": {
              "array": [
                "u8",
                65
              ]
            }
          }
        ]
      }
    },
    {
      "name": "proofKind",
      "docs": [
        "Objective condition that can release a milestone without the client."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "off"
          },
          {
            "name": "prMerged"
          },
          {
            "name": "checkRun"
          }
        ]
      }
    },
    {
      "name": "proofTargetSet",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "deal",
            "type": "pubkey"
          },
          {
            "name": "index",
            "type": "u8"
          },
          {
            "name": "proofKind",
            "type": {
              "defined": {
                "name": "proofKind"
              }
            }
          },
          {
            "name": "proofRef",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "proofVerified",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "deal",
            "type": "pubkey"
          },
          {
            "name": "index",
            "type": "u8"
          },
          {
            "name": "identifier",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "submitter",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "side",
      "docs": [
        "Which side an arbiter votes for."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "worker"
          },
          {
            "name": "client"
          }
        ]
      }
    },
    {
      "name": "voteCast",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "deal",
            "type": "pubkey"
          },
          {
            "name": "index",
            "type": "u8"
          },
          {
            "name": "judge",
            "type": "pubkey"
          },
          {
            "name": "side",
            "type": {
              "defined": {
                "name": "side"
              }
            }
          },
          {
            "name": "workerVotes",
            "type": "u8"
          },
          {
            "name": "clientVotes",
            "type": "u8"
          },
          {
            "name": "decided",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "workSubmitted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "deal",
            "type": "pubkey"
          },
          {
            "name": "index",
            "type": "u8"
          },
          {
            "name": "deliverableHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "uri",
            "type": "string"
          },
          {
            "name": "reviewDeadline",
            "type": "i64"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "dealSeed",
      "docs": [
        "Seed of the `Deal` PDA: `[DEAL_SEED, client, deal_id (u64 LE)]`."
      ],
      "type": "bytes",
      "value": "[100, 101, 97, 108]"
    },
    {
      "name": "maxWindowSecs",
      "docs": [
        "Upper bound for every timer: 365 days."
      ],
      "type": "u32",
      "value": "31536000"
    },
    {
      "name": "minWindowSecs",
      "docs": [
        "Lower bound for every timer. Short on purpose so a live demo can use 30-45 s",
        "windows; this is a documented limitation, not a production value."
      ],
      "type": "u32",
      "value": "10"
    },
    {
      "name": "proofParamsAfterUrl",
      "type": "string",
      "value": "\"\\\"}\""
    },
    {
      "name": "proofParamsBeforeUrl",
      "type": "string",
      "value": "\"{\\\"body\\\":\\\"\\\",\\\"method\\\":\\\"GET\\\",\\\"responseMatches\\\":[{\\\"type\\\":\\\"contains\\\",\\\"value\\\":\\\"\\\\\\\"merged_at\\\\\\\":\\\\\\\"2\\\"}],\\\"responseRedactions\\\":[],\\\"url\\\":\\\"\""
    },
    {
      "name": "proofProvider",
      "type": "string",
      "value": "\"http\""
    },
    {
      "name": "vaultSeed",
      "docs": [
        "Seed of the vault token account PDA: `[VAULT_SEED, deal]`."
      ],
      "type": "bytes",
      "value": "[118, 97, 117, 108, 116]"
    }
  ]
};
