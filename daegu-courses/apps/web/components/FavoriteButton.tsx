import { toggleFavoriteAction } from "@/app/favorites/actions";

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
        style={{
          background: "transparent",
          border: 0,
          padding: 0,
          fontSize: 20,
          lineHeight: 1,
          cursor: "pointer",
          color: props.isFavorited ? "#f5a623" : "#bbb",
        }}
      >
        {props.isFavorited ? "★" : "☆"}
      </button>
    </form>
  );
}
