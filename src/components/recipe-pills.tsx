import { recipeKindLabel, recipeResourceLabel } from "@/lib/recipe-meta.mjs";
import "./recipe-pills.css";

type RecipePillsProps = { kind?: string; uses?: string[]; className?: string };

// What a recipe builds (Agent or App), then the Volcano resources it leans on
// most. Plain labels, not links: on a card the whole card is already a link.
export function RecipePills({ kind, uses = [], className }: RecipePillsProps) {
  if (!kind && uses.length === 0) return null;
  return (
    <ul data-slot="recipe-pills" className={`recipe-pills ${className ?? ""}`} aria-label="Recipe details">
      {kind && (
        <li data-slot="recipe-pill" data-variant="kind" className="recipe-pill">
          {recipeKindLabel(kind)}
        </li>
      )}
      {uses.map(function renderResource(slug) {
        return (
          <li key={slug} data-slot="recipe-pill" className="recipe-pill">
            {recipeResourceLabel(slug)}
          </li>
        );
      })}
    </ul>
  );
}
