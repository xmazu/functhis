import { Button } from '@functhis/ui/components/button';
import { useRouteContext } from '@tanstack/react-router';

export default function UserMenu() {
  const { consoleUrl } = useRouteContext({ from: '__root__' });

  return (
    <Button render={<a href={`${consoleUrl}/login`} />} variant="outline">
      Sign in
    </Button>
  );
}
