"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { GroupsQueryResult } from "@/lib/queries/groups";
import { fetchGroups } from "@/services/group-service";
import {
  createGroup,
  updateGroup,
  updateGroupLeader,
  deleteGroup,
  addGroupMember,
  removeGroupMember,
  setMemberTarget,
} from "@/actions/groups";
import type { CreateGroupInput, UpdateGroupInput, SetMemberTargetInput } from "@/lib/validations/user";

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

export function useSetMemberTarget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SetMemberTargetInput) => setMemberTarget(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function useUpdateGroupLeader() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, leaderId }: { groupId: string; leaderId: string }) =>
      updateGroupLeader(groupId, leaderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}
