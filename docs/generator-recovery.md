# Generator Transactions and Recovery

`@eljs/generator` coordinates writes to a physical target directory and restores
the original directory if generation fails. This applies to both `force` and
`merge`.

## Target Ownership

The lock is stored in the target's parent directory. Symbolic-link aliases and
calls from different ancestor working directories share the same physical
target lock. Missing parent directories are created before acquiring the lock;
`ProjectGenerator` still validates the caller's working-directory boundary.

Existing targets are moved to a `.eljs-backup-*` directory directly under the
original canonical working directory. The backup is deleted only after
generation succeeds. Recovery continues to use that original boundary even
when a later call starts from another ancestor working directory.

## Recovery States

Version 2 lock metadata records the original canonical working directory and
the transaction state:

| State              | Recovery on the next run                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| `active`           | Restore the backup, or remove incomplete output when the target was newly created                       |
| `committing`       | Keep the new target and remove the remaining backup; a missing target produces `CREATE_RECOVERY_FAILED` |
| `recovery-pending` | Retry the recorded rollback or commit cleanup, even if the previous process is still alive              |

Initial metadata is written completely before the public lock is atomically
published. The `committing` state is persisted before backup deletion begins,
so recovery never restores a backup that may already have been partially
deleted.

Rollback removes disposable output before moving the backup back without
overwriting another directory. A process exit between those steps leaves the
recovery record and backup available. Failed rollback or commit cleanup
retains the recovery record; once target operations stop, the process hands
it off as `recovery-pending` while holding the acquisition mutex.

Recovery verifies that the original working directory remains an ancestor of
the target and that the backup remains directly under it without overlapping
the target. Multiple recovery records, incomplete locks, or unverifiable
paths are retained and reported as errors.

## Operational Limits

- Locks coordinate cooperating generator processes; they do not prevent an
  unrelated process from replacing directories or modifying lock files
- Locks on another host and processes whose exit cannot be confirmed are not
  automatically taken over
- Immutable acquisition-mutex tombstones prevent delayed contenders from
  deleting a successor's lock
- Permission failures retain existing state and require permission repair or
  inspection before recovery can continue
- Recovery covers process exits, not directory durability during power loss
- Empty parent directories and private temporary files left before initial
  lock publication are not automatically removed; they do not represent a
  started target transaction
