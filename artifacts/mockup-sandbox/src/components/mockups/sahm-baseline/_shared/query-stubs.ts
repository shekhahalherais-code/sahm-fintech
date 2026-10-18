export function useQueryClient() {
  return {
    invalidateQueries: async (_options?: { queryKey?: unknown }) => undefined,
  };
}
