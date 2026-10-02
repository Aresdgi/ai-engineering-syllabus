import {
  EmptySourceState,
  type EmptySourceStateProps,
} from "@/components/empty-source-state";

export type SourceUnavailableStateProps = EmptySourceStateProps;

export function SourceUnavailableState({
  lang = "es",
}: SourceUnavailableStateProps) {
  return <EmptySourceState lang={lang} />;
}
