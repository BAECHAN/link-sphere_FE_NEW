import { Input, InputProps } from '@/shared/ui/atoms/input';
import { ToggleButton } from '@/shared/ui/elements/ToggleButton';
import { useUiTexts } from '@baechan/ui/texts/UiTextsProvider';
import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export const PasswordInput = forwardRef<HTMLInputElement, InputProps>(
  ({ disabled, ...props }, ref) => {
    const uiTexts = useUiTexts();
    const [showPassword, setShowPassword] = useState(false);

    return (
      <div className="relative">
        <Input ref={ref} disabled={disabled} {...props} type={showPassword ? 'text' : 'password'} />
        <ToggleButton
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setShowPassword((prev) => !prev)}
          disabled={disabled}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full text-muted-foreground hover:text-foreground"
        >
          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          <span className="sr-only">
            {showPassword ? uiTexts.passwordInput.hide : uiTexts.passwordInput.show}
          </span>
        </ToggleButton>
      </div>
    );
  }
);
PasswordInput.displayName = 'PasswordInput';
