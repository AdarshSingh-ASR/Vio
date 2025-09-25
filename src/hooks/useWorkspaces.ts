import { createWorkspace } from "@/actions/workspace";
import { useMutation } from "@tanstack/react-query";
import { useMutationData } from "./useMutationData";
import { z } from "zod";
import useZodForm from "./useZodForm";
import { workspaceSchema } from "@/components/forms/workspace-forms/schema";

export const useCreateWorkspace = () => {
  const mutation = useMutationData(
    ["create-workspace"],
    (data: {name: string}) => createWorkspace(data.name),
    'user-workspaces'
  );

  const {register, handleSubmit, onFormSubmit, errors} = useZodForm(workspaceSchema, mutation.mutate) 

  return {register, handleSubmit, onFormSubmit, errors, isPending: mutation.isPending}
};