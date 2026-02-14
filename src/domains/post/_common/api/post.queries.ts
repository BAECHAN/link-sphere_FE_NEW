import { useMutation } from '@tanstack/react-query';
import { postApi } from '@/domains/post/_common/api/post.api';
import { CreatePost } from '@/domains/post/_common/model/post.schema';
import { TEXTS } from '@/shared/config/texts';
import { postInvalidateQueries } from '@/domains/post/_common/api/post.keys';

export const useCreatePostMutation = () => {
  return useMutation({
    mutationFn: async (payload: CreatePost) => {
      return await postApi.createPost(payload);
    },
    meta: {
      successMessage: TEXTS.messages.post.success.postCreated,
      errorMessage: TEXTS.messages.post.error.postCreateFailed,
    },
    onSuccess: () => {
      postInvalidateQueries.list();
    },
  });
};
