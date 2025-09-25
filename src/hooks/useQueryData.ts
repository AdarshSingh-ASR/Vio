import { QueryFunction, QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query"

export const useQueryData = (
    queryKey: QueryKey,
    queryFn: QueryFunction,
    options?: Omit<UseQueryOptions<any, any, any, any>, "queryKey" | "queryFn">
) => {
    const {data, isPending, isFetched, refetch, isFetching} = useQuery({
        queryKey,
        queryFn,
        ...options,
    })

    return {data, isPending, isFetched, refetch, isFetching}
}