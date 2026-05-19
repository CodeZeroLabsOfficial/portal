# Firestore security rules

Rules live in [`firestore.rules`](../firestore.rules) and deploy with the Firebase CLI.

## Deploy

From the Portal project root (where `firebase.json` and `.firebaserc` live):

```bash
firebase deploy --only firestore:rules
```

To deploy rules and indexes together:

```bash
firebase deploy --only firestore
```

Use the Firebase Console **Rules** tab to diff against production before the first deploy if you already maintain rules only in the console.

## `services`

Matches `contract_templates`: **staff read** for the user’s org; **all writes denied** (Services CRUD uses Next.js Server Actions + Admin SDK).

| Operation | Client SDK | Server (Admin SDK) |
|-----------|------------|---------------------|
| read | `admin` / `team`, same `organizationId` | Allowed |
| create / update / delete | Denied | Allowed |

### List queries

If you add client reads later, filter by org:

```js
collection(db, 'services').where('organizationId', '==', myOrgId)
```

### Block to add in Firebase Console

Place after `customers` and before `contract_templates` (or alongside Templates):

```
    match /services/{serviceId} {
      allow read: if isStaff()
        && userOrgId() is string
        && resource.data.organizationId is string
        && resource.data.organizationId == userOrgId();

      allow create, update, delete: if false;
    }
```

## Emulator (optional)

```bash
firebase emulators:start --only firestore
```

Point local env at the emulator if you add client-side Firestore reads in development.
