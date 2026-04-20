"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { GroupsQueryResult } from "@/lib/queries/groups";
import { fetchGroups } from "@/services/group-service";
import {
  createGroup,
  updateGroup,
  deleteGroup,
  addGroupMember,
  removeGroupMember,
  reorderGroups,
  reorderGroupMembers,
} from "@/actions/group";
import type { CreateGroupInput, UpdateGroupInput } from "@/lib/validations/user";

export function useGroups(initialData?: GroupsQueryResult) {
  return useQuery({
    queryKey: ["groups"],
    queryFn: fetchGroups,
    initialData,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateGroupInput) => createGroup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateGroupInput) => updateGroup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => deleteGroup(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function useAddGroupMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      addGroupMember(groupId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function useRemoveGroupMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      removeGroupMember(groupId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function useReorderGroups() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => reorderGroups(orderedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function useReorderGroupMembers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      groupId,
      orderedUserIds,
    }: {
      groupId: string;
      orderedUserIds: string[];
    }) => reorderGroupMembers(groupId, orderedUserIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}
