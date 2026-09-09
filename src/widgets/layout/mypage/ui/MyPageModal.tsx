import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/ui/atoms/dialog';
import { UpdateAccountForm } from '@/features/account/update/ui/UpdateAccountForm';
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
        <UpdateAccountForm onSuccess={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
