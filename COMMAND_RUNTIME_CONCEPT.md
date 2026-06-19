# Command Runtime

## Concept, Vision et Architecture

Version : 0.1
Statut : Prototype / Design Document

---

# 1. Vision

**Command Runtime** est une librairie TypeScript permettant de construire des systèmes de commandes fortement typés, introspectables et exécutables depuis différents environnements.

L'objectif n'est pas uniquement de créer une CLI, mais de créer un **runtime universel de commandes**.

Une commande est une unité d'exécution indépendante pouvant être exposée via différents adapters :

* CLI
* HTTP API
* RPC
* AI Agent
* GUI
* autres interfaces futures

Le même contrat de commande doit pouvoir être exécuté partout sans modifier son implémentation.

---

# 2. Philosophie du projet

## 2.1 Approche shadcn-like

Command Runtime n'est pas pensé comme une dépendance opaque installée depuis npm.

L'approche principale est :

> Copier le dossier `command-runtime` dans son projet et l'adapter selon ses besoins.

L'utilisateur possède le code source.

Avantages :

* modification facile
* compréhension complète du fonctionnement interne
* pas de dépendance forte envers une roadmap externe
* possibilité d'adapter l'architecture au contexte métier

---

# 3. Structure du projet

Structure recommandée :

```
command-runtime/

├── README.md

├── core/
│   ├── command.ts
│   ├── runtime.ts
│   ├── context.ts
│   └── result.ts

├── decorators/
│   ├── command.decorator.ts
│   ├── option.decorator.ts
│   └── child.decorator.ts

├── contracts/
│   ├── command.contract.ts
│   ├── context.contract.ts
│   ├── adapter.contract.ts
│   └── middleware.contract.ts

├── runtime/
│   ├── resolver.ts
│   ├── executor.ts
│   └── pipeline.ts

├── adapters/

│   ├── cli/
│   │   └── cli-adapter.ts
│
│   ├── http/
│   │   └── http-adapter.ts
│
│   ├── rpc/
│   │   └── rpc-adapter.ts
│
│   ├── ai/
│   │   └── ai-adapter.ts
│
│   └── gui/
│       └── gui-adapter.ts

├── testing/
│   ├── mocks/
│   └── helpers/

├── examples/

└── docs/

    ├── architecture.md
    ├── commands.md
    ├── middleware.md
    ├── adapters.md
    ├── testing.md
    └── ai-integration.md
```

---

# 4. Concept principal : Command

Une commande représente une unité d'action.

Elle peut être :

* une action métier
* une action technique
* une opération système
* une opération distante

Exemples :

```text
CreateUser
DeleteFile
GenerateReport
SendEmail
DatabaseMigration
DeployApplication
```

Le framework ne décide pas de la signification d'une commande.

L'utilisateur définit son propre modèle.

---

# 5. Command Contract

Chaque commande possède plusieurs contrats :

## Input Contract

Les données nécessaires à l'exécution.

Exemple :

```ts
input: string
```

ou :

```ts
input: CreateUserInput
```

---

## Output Contract

Le résultat produit.

Exemple :

```ts
User
```

---

## Context Contract

Les dépendances nécessaires pendant l'exécution.

Exemple :

```ts
interface CommandContext {

    logger: Logger

    database: Database

    environment: Environment

}
```

Le contexte doit rester fortement typé.

---

# 6. Décorateurs

L'expérience développeur est une priorité.

L'approche principale utilise les décorateurs TypeScript.

Exemple :

```ts
@Command({
    name:"user",
    description:"Manage users"
})
class UserCommand {}
```

---

Sous-command :

```ts
@Command({
    name:"create",
    description:"Create user"
})
class CreateUserCommand {}
```

---

Options :

```ts
@CommandOption({
    name:"age",
    alias:"a"
})
get age(){

    return this.option("age")

}
```

---

# 7. Command Tree

Les commandes sont organisées sous forme d'arbre.

Exemple :

```
application

├── user

│   ├── create

│   ├── delete

│   └── list


└── project

    ├── deploy

    └── build
```

Chaque niveau peut :

* ajouter du contexte
* ajouter du middleware
* transformer l'exécution
* créer dynamiquement ses enfants

---

# 8. Parent / Child System

Un enfant n'est pas enregistré statiquement.

Le parent peut construire son enfant.

Exemple :

```ts
@CommandChild({

    Constructor(parent){

        return new CreateUserCommand(parent)

    }

})
create(){}
```

Pourquoi ?

Parce qu'un même child peut être utilisé dans différents contextes.

Exemple :

```
AdminUserCommand

        |
        |
        +-- CreateUserCommand


CustomerCommand

        |
        |
        +-- CreateUserCommand
```

La création dépend du parent.

---

# 9. Context System

Le parent/enfant représente la structure.

Le contexte représente l'exécution.

Exemple :

```ts
interface CommandContext {

    user?: User

    permissions: Permission[]

    logger: Logger

}
```

Une commande peut recevoir :

* contexte global
* contexte parent
* contexte adapter

---

# 10. Middleware System

Command Runtime utilise deux niveaux de middleware.

## Global Middleware

Appliqué à toutes les commandes.

Exemple :

```
Logger
Authentication
Tracing
Validation
```

---

## Command Middleware

Attaché à une commande.

Exemple :

```
UserCommand

    middleware:
        CheckPermission


CreateUserCommand

    middleware:
        ValidateInput
```

---

Pipeline :

```
Global Middleware

        |

Parent Middleware

        |

Child Middleware

        |

Execute Command

        |

Result Middleware
```

---

# 11. Result System

Les erreurs sont retournées explicitement.

Le runtime ne force pas l'utilisation des exceptions.

Exemple :

```ts
type CommandResult<T> =

{
    success:true
    data:T
}

|

{
    success:false
    errors:CommandError[]
}
```

L'utilisateur décide comment traiter les erreurs.

---

# 12. Validation System

Command Runtime ne dépend pas d'une librairie spécifique.

Le système de validation utilise un standard.

Objectif :

Supporter tous les validateurs compatibles avec :

Standard Schema

https://standardschema.dev/

Exemples possibles :

* Zod
* Valibot
* ArkType
* autres validateurs compatibles

---

# 13. Runtime

Le runtime est responsable de :

* résolution des commandes
* création du contexte
* exécution middleware
* validation
* exécution
* retour du résultat

Flux :

```
Input

 |

Resolver

 |

Command Tree

 |

Context Creation

 |

Middleware Pipeline

 |

Command Execute

 |

Result
```

---

# 14. Adapter System

Le runtime ne dépend pas du canal d'entrée.

Architecture :

```
             Command Runtime

                    |

        +-----------+------------+

        |           |            |

       CLI        HTTP         RPC

        |

       AI

        |

       GUI
```

---

## CLI Adapter

Transforme :

```bash
app user create jack
```

en :

```ts
runtime.execute(
{
 command:"user.create",
 input:"jack"
})
```

---

## HTTP Adapter

Transforme :

```
POST /commands/user.create
```

en :

```ts
runtime.execute()
```

---

## AI Adapter

Possibilité future :

Transformer automatiquement les commandes en outils pour agents IA.

Exemple :

```json
{
"name":"user.create",
"description":"Create a user",
"inputSchema":{}
}
```

---

# 15. Introspection

Toutes les métadonnées doivent être accessibles.

Objectifs :

## Help automatique

```bash
app user create --help
```

---

## Documentation automatique

Génération :

```
docs/

user.md

user-create.md
```

---

## Autocomplete

Support futur :

```bash
app user <TAB>
```

---

## UI Generation

Possibilité future :

Créer automatiquement des interfaces graphiques depuis les contrats.

---

# 16. Testing Philosophy

Le framework doit être facilement testable.

Priorités :

* interfaces fortes
* context mockable
* dependency injection minimale
* tests unitaires
* tests e2e
* tests de types TypeScript

Exemple :

```ts
const contextMock = {

 logger:mockLogger,

 database:mockDatabase

}
```

---

# 17. Dependency Injection

Command Runtime fournit un système minimal.

Objectif :

* simple
* fortement typé
* facilement testable

Le contexte reste le mécanisme principal.

---

# 18. Ce que Command Runtime n'est pas

Command Runtime n'est pas :

* un framework backend complet
* un remplacement de NestJS
* une CLI uniquement
* un système imposant une architecture métier

Il fournit uniquement :

* un modèle de commande
* un runtime d'exécution
* des contrats
* des adapters

L'utilisateur garde le contrôle.

---

# 19. Potentiel futur

Command Runtime peut devenir une couche universelle entre :

* applications
* utilisateurs
* APIs
* agents IA
* interfaces graphiques

Une commande devient une capacité exposable partout.

Exemple :

Une seule définition :

```
CreateInvoiceCommand
```

peut devenir :

```
CLI command

HTTP endpoint

RPC method

AI Tool

GUI Action
```

sans réécrire la logique.

---

# 20. Principe directeur

> Une commande est un contrat exécutable, documentable et exposable.

Le rôle du runtime est de gérer son cycle de vie.

Le rôle de l'utilisateur est de définir son intention métier.
