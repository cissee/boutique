import { getMessages } from "@/i18n";

export default function Loading() {
  return <p className="text-muted">{getMessages().common.loading}</p>;
}
