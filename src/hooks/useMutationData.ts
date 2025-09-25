import { MutationFunction, MutationKey, useMutation, useMutationState, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const useMutationData = (
  mutationKey: MutationKey,
  mutationFn: MutationFunction<any, any>,
  queryKey?: string,
  onSuccess?: (data: any) => void
) => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationKey: [mutationKey],
    mutationFn,
    onSuccess: (data) => {
      if (onSuccess) onSuccess(data);
      return toast.success(data.status === 200 ? "Success" : "Error", {description: data?.data});
    },
    onSettled: async () => {
      if (queryKey) queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
  });

return mutation;
};

export const useMutationDataState = (mutationKey: MutationKey) => {
  const data = useMutationState ({
    filters: { mutationKey },
    select: (mutation) => {
        return {
          variables: mutation.state.variables as any,
          status: mutation.state.status,
        }
      },
    })
  
    const latestVariables = data[data.length - 1]
    return { latestVariables }
  }
