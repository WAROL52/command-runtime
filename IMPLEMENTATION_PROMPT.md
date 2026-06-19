# Implementation Prompt — Command Runtime

## Rôle

Tu es un ingénieur logiciel senior spécialisé en architecture TypeScript, design de librairies, systèmes de runtime et DX (Developer Experience).

Ta mission est d'implémenter **Command Runtime**, une librairie TypeScript de commandes fortement typées, extensible et introspectable.

Tu dois respecter la philosophie et les contraintes définies dans ce document.

---

# 1. Vision du projet

Command Runtime n'est pas une simple librairie CLI.

C'est un **runtime universel d'exécution de commandes**.

Une commande est une unité exécutable qui peut être utilisée depuis plusieurs interfaces :

* CLI
* HTTP
* RPC
* AI Agent
* GUI
* autres adapters futurs

Le runtime ne doit jamais dépendre d'un canal d'entrée spécifique.

Le CLI n'est qu'un adapter.

---

# 2. Philosophie de développement

Le projet suit une approche similaire à shadcn.

Cela signifie :

* le code doit être simple à comprendre
* l'utilisateur doit pouvoir copier le dossier `command-runtime`
* l'utilisateur doit pouvoir modifier le code selon ses besoins
* éviter les abstractions inutiles
* privilégier les interfaces et les contrats
* favoriser la composition plutôt que l'héritage complexe

Le projet doit être facilement forkable.

---

# 3. Objectif architecture

L'architecture principale :

```
Input Adapter

      |

Command Runtime

      |

Command Tree

      |

Middleware Pipeline

      |

Command Execution

      |

Result
```

---

# 4. Contraintes techniques

## Langage

Utiliser :

* TypeScript strict
* decorators TypeScript
* generics avancés lorsque nécessaire
* interfaces fortement typées

---

## Validation

Ne pas dépendre directement de Zod.

Utiliser une abstraction compatible avec :

Standard Schema

https://standardschema.dev/

Le runtime doit accepter n'importe quel validateur compatible.

Exemple :

```ts
interface SchemaAdapter<T> {

    parse(value:unknown):T

}
```

---

# 5. Philosophie Command

Une commande représente une capacité.

Elle peut être :

* métier

Exemple :

```
CreateUser
ApproveInvoice
SendEmail
```

ou :

* technique

Exemple :

```
DatabaseMigration
BuildProject
GenerateFile
```

Le runtime ne doit pas imposer cette distinction.

---

# 6. API Developer Experience

L'utilisation doit être déclarative.

Exemple attendu :

```ts
@Command({
    name:"user",
    description:"Manage users"
})
class UserCommand {

}
```

Sous commande :

```ts
@Command({
    name:"create",
    description:"Create a user"
})
class CreateUserCommand {

}
```

---

# 7. Command Interface

Chaque commande doit pouvoir définir :

* metadata
* input contract
* output contract
* options
* children
* middleware
* execution

Exemple :

```ts
class CreateUserCommand 
extends CommandInterface<UserCommand>{

    async execute(
        input:string
    ){

        return {
            name:input
        }

    }

}
```

---

# 8. Parent / Child Architecture

Le système parent/enfant est fondamental.

Un parent peut construire dynamiquement son enfant.

Ne pas utiliser uniquement une déclaration statique.

Exemple :

```ts
@CommandChild({

    Constructor(parent){

        return new CreateUserCommand(parent)

    }

})
create(){

}
```

Pourquoi :

* un même child peut être utilisé dans plusieurs contextes
* le parent contrôle la création
* possibilité d'injection spécifique

---

# 9. Context System

Créer un système de contexte fortement typé.

Le contexte représente l'environnement d'exécution.

Exemple :

```ts
interface CommandContext {

    logger:Logger

    database:Database

    environment:Environment

}
```

Le contexte doit être :

* injectable
* mockable
* testable

---

# 10. Middleware System

Implémenter deux niveaux.

## Global Middleware

Appliqué à toutes les commandes.

Exemples :

* logging
* tracing
* authentication
* validation

## Command Middleware

Attaché à une commande spécifique.

Pipeline :

```
Global Middleware

        |

Parent Middleware

        |

Child Middleware

        |

Execute

        |

Result Middleware
```

---

# 11. Result System

Ne pas imposer les exceptions pour les erreurs métier.

Utiliser un résultat typé.

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

# 12. Runtime Engine

Le runtime doit être responsable de :

* enregistrer les commandes
* construire l'arbre
* résoudre une commande
* créer le contexte
* exécuter middleware
* exécuter la commande
* retourner un résultat

---

# 13. Adapter Architecture

Les adapters doivent être séparés.

Structure :

```
adapters/

    cli/

    http/

    rpc/

    ai/

    gui/
```

Le runtime ne doit pas connaître ces adapters.

---

# 14. Introspection

Toutes les métadonnées doivent être accessibles.

Objectifs :

## Help automatique

Exemple :

```
app user create --help
```

---

## Documentation automatique

Générer :

```
docs/

user.md

user-create.md
```

---

## Autocomplétion

Support futur :

```
app user <TAB>
```

---

## AI Integration

Préparer la possibilité de générer :

* MCP tools
* AI function schema
* agent capabilities

---

# 15. Testing

Le projet doit être conçu pour le test.

Obligatoire :

* tests unitaires
* tests e2e
* tests TypeScript

Les interfaces doivent permettre :

* mocks simples
* fake context
* fake adapters

Exemple :

```ts
const contextMock = {

    logger:mockLogger,

    database:mockDatabase

}
```

---

# 16. Dependency Injection

Créer un système minimal.

Ne pas reproduire un framework DI complet.

Priorité :

* simplicité
* typage
* testabilité

Le contexte reste le mécanisme principal.

---

# 17. Structure recommandée

Créer :

```
command-runtime/

README.md

src/

    core/

    decorators/

    contracts/

    runtime/

    adapters/

    testing/

examples/

docs/

tests/
```

---

# 18. Méthode d'implémentation

Ne pas tout coder immédiatement.

Procéder par étapes :

## Phase 1

Créer :

* Command contract
* decorators
* metadata storage
* command registry

## Phase 2

Créer :

* command tree
* parent child
* resolver

## Phase 3

Créer :

* runtime executor
* context
* middleware

## Phase 4

Créer :

* adapters

## Phase 5

Créer :

* introspection
* documentation generator
* autocomplete

---

# 19. Règles importantes

Ne jamais :

* coupler le runtime au CLI
* dépendre directement d'un validateur
* créer une abstraction sans besoin concret
* sacrifier le typage pour la simplicité
* cacher la logique importante derrière de la magie

Toujours privilégier :

* lisibilité
* composabilité
* extensibilité
* expérience développeur

---

# 20. Critère de réussite

Une implémentation réussie doit permettre :

```ts
@Command({
    name:"user"
})
class UserCommand{}
```

puis :

CLI :

```
app user create bob
```

HTTP :

```
POST /commands/user.create
```

AI :

```
tool:user.create
```

tout en partageant :

* le même contrat
* la même logique
* le même runtime

---

## Principe directeur final

Une commande est un contrat exécutable.

Le runtime orchestre son cycle de vie.

Les adapters exposent ses capacités.

L'utilisateur garde le contrôle.
