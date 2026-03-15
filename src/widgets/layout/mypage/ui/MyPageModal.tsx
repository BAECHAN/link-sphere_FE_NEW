import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/ui/atoms/dialog';
import { UpdateProfileForm } from '@/features/auth/profile/ui/UpdateProfileForm';
import { TEXTS } from '@/shared/config/texts';

interface MyPageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MyPageModal({ open, onOpenChange }: MyPageModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{TEXTS.mypage.title}</DialogTitle>
          <DialogDescription>{TEXTS.mypage.description}</DialogDescription>
        </DialogHeader>
        <UpdateProfileForm onSuccess={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
