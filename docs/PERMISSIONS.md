# Who can do what

There is no admin instruction, no fee account and no pause in the program
(`programs/milestone_escrow/src/lib.rs` lists every instruction). Authorization
is enforced by account constraints (`has_one = client`, `has_one = worker`) and by
the arbiter check in `cast_vote`.

| Operation | Client | Worker | Arbiter | Anyone | Author before `--final` | Author after `--final` |
|---|---|---|---|---|---|---|
| Create and fund deal | yes | | | | | |
| Accept | | yes | | | | |
| Submit work | | yes | | | | |
| Approve (or concede a dispute) | yes | | | | | |
| Object (with deposit) | yes | | | | | |
| Vote | | | yes (own slot, once) | | | |
| Bind PR to milestone | yes (once) | | | | | |
| Submit proof | yes | yes | yes | yes | | |
| Cancel before acceptance | yes | | | after accept deadline | | |
| Cancel after acceptance | needs both | needs both | | | | |
| Withdraw own cancel request | yes | yes | | | | |
| Trigger payout (settle) | yes | yes | yes | yes | | |
| Close and return rent | yes | yes | yes | yes | | |
| Receive escrowed funds | per rule | per rule | never | never | never (by program rules) | never |
| Replace program code | | | | | **yes (backdoor)** | **no** |
| Change IDL metadata | | | | | yes (cosmetic) | yes (cosmetic, no effect on funds) |

Outside our program:
- The attestor named in a deal can sign a false claim for that deal's proof milestones (and only those).
- GitHub is the fact source for proof milestones.
- A token issuer with freeze authority can freeze accounts (not applicable to tUSDC, which is created with no freeze authority).

Check the upgrade authority at any time:

```
solana program show <PROGRAM_ID> -u devnet
```
