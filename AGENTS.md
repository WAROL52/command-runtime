# Command Runtime — Guide pour les agents

## Structure du projet

```
src/              # Code source
docs/             # Documentation complète
tests/            # Tests Vitest
examples/         # Exemples
.opencode/        # Configuration opencode
```

## Commandes utiles

```bash
npm test          # Lancer tous les tests
npm run typecheck # Vérifier TypeScript
```

## Conventions clés

- Decorators appelés programmatiquement dans les tests (contournement esbuild)
- Résultat via `CommandResult<T>` (pas d'exceptions)
- Contexte passé en paramètre, jamais sur `this`
- `Constructor(parent)` pas `Constructor() { ... this }`
- `nextChild()` skips le direct child (`startIndex = 2`)
