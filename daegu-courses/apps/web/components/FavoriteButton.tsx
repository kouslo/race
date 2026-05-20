import { toggleFavoriteAction } from "@/app/favorites/actions";
import { cn } from "@/components/ui/cn";

export function FavoriteButton(props: {
  targetType: "course" | "event";
  targetId: string;
  isFavorited: boolean;
  /** Path to revalidate after toggling, also used for the post-login redirect. */
  nextPath: string;
}) {
  return (
    <form action={toggleFavoriteAction.bind(null, props.targetType, props.targetId, props.nextPath)}>
      <button
        type="submit"
        aria-label={props.isFavorited ? "즐겨찾기 해제" : "즐겨찾기 추가"}
        title={props.isFavorited ? "즐겨찾기 해제" : "즐겨찾기 추가"}
        className={cn(
          "bg-transparent border-0 p-0 text-[22px] leading-none cursor-pointer",
          props.isFavorited ? "text-accent" : "text-foreground-subtle hover:text-foreground-muted",
        )}
      >
        {props.isFavorited ? "★" : "☆"}
      </button>
    </form>
  );
}
