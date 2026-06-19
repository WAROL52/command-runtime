# Introspection

← [Middleware](middleware.md) · [Exemples →](examples.md)

---

Le runtime expose toutes ses métadonnées pour la génération d'aide, de documentation et d'autocomplétion.

---

## Command Tree

```ts
interface CommandMeta {
  name: string
  alias?: string
  description?: string
  examples?: { cmd: string; description: string }[]
  input?: boolean
  output?: boolean
  options?: CommandOptionMeta[]
  children?: CommandChildMeta[]
}
```

| Méthode | Description |
|---------|-------------|
| `runtime.getCommandTree()` | Retourne l'arbre complet |
| `runtime.findCommand(["user", "create"])` | Trouve une commande par son path |

---

## Help Generator

```ts
runtime.generateHelp(["user", "create"])
```

Retourne un texte formaté :

```
mycli user create — Create a new user

USAGE
  mycli user create <input> [options]

ARGUMENTS
  input    required

OPTIONS
  --age, -a    User age
  --description, -d    User description
```

---

## Documentation Generator

```ts
runtime.generateDocs()
// → { "README.md": "..." }

runtime.generateDocs({ perCommand: true })
// → { "README.md": "...", "user.md": "...", "user-create.md": "..." }
```

Le `DocGenerator` (`src/runtime/docgen.ts`) produit un index + une section par commande, avec utilisation, options et sous-commandes.

---

## Completion Generator

```ts
runtime.generateCompletion("bash")
runtime.generateCompletion("zsh")
```

Génère des scripts d'autocomplétion shell :

```bash
# Bash
_mycli_completion() {
  local cur=${COMP_WORDS[COMP_CWORD]}
  local commands="user create"
  local options="--age -a --description -d"
  COMPREPLY=($(compgen -W "$commands" -- "$cur"))
  COMPREPLY+=($(compgen -W "$options" -- "$cur"))
}
complete -F _mycli_completion mycli
```

### Installation

```bash
# Bash
eval "$(mycli completion bash)"       # si exposé via CLI
source <(runtime.generateCompletion("bash"))

# Zsh
eval "$(mycli completion zsh)"        # si exposé via CLI
source <(runtime.generateCompletion("zsh"))
```

---

## Navigation

- **Précédent :** [Middleware ↑](middleware.md)
- **Suivant :** [Exemples →](examples.md)
- **Index :** [↑ Index](index.md)
