import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ZodSchema } from "zod";
import { UseMutateFunction } from "@tanstack/react-query";

const useZodForm = (schema: ZodSchema, mutation: UseMutateFunction, defaultValues?: any) => {
  const {register, watch, reset, handleSubmit, formState: {errors}} = useForm({
    resolver: zodResolver(schema),
    defaultValues
  });   

  const onFormSubmit = handleSubmit(async (values) => mutation({...values}))

  return {register, watch, reset, handleSubmit, errors, onFormSubmit}
};
export default useZodForm;