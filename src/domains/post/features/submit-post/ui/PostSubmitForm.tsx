import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/atoms/card';
import { Label } from '@/shared/ui/atoms/label';
import { Input } from '@/shared/ui/atoms/input';
import { Button } from '@/shared/ui/atoms/button';
import { Checkbox } from '@/shared/ui/atoms/checkbox';
import { useState } from 'react';
import { POST_CATEGORY_OPTIONS } from '@/domains/post/_common/config/const';

export function PostSubmitForm() {
  const [url, setUrl] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isLoading, _] = useState(false);

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  return (
    <div className="flex justify-center w-full py-8">
      <Card className="w-full max-w-2xl">
        <CardHeader className="p-6">
          <CardTitle className="text-2xl">링크 공유하기</CardTitle>
          <CardDescription>
            팀원들과 공유하고 싶은 유용한 아티클이나 리소스의 URL을 입력하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <form onSubmit={() => {}} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                placeholder="https://example.com/amazing-article"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                disabled={isLoading}
                className="h-11"
              />
              <p className="text-sm text-muted-foreground">
                자동으로 제목과 이미지를 가져오고 태그를 생성합니다.
              </p>
            </div>

            <div className="space-y-3">
              <Label>관심 분야 (선택사항)</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {POST_CATEGORY_OPTIONS.map((category) => (
                  <div key={category} className="flex items-center space-x-2">
                    <Checkbox
                      id={category}
                      checked={selectedCategories.includes(category)}
                      onCheckedChange={() => toggleCategory(category)}
                      disabled={isLoading}
                    />
                    <label
                      htmlFor={category}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer select-none"
                    >
                      {category}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <Button type="submit" disabled={isLoading} className="w-full h-11 text-base">
              {isLoading ? '공유하는 중...' : '링크 공유하기'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
