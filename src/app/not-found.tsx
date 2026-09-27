import { PlaceholderPage } from "@/components/site/placeholder-page";

export default function NotFound() {
  return (
    <PlaceholderPage
      title="Page not found"
      phase="404"
      summary="The page you asked for does not exist or has moved."
    />
  );
}
