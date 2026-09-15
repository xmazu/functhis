import { Button } from '@functhis/ui/components/button';
import { useRouteContext } from '@tanstack/react-router';

const UserMenu = () => {
  const { consoleUrl } = useRouteContext({ from: '__root__' });

  return (
    <Button
      render={<a aria-label="Sign in" href={`${consoleUrl}/login`} />}
      variant="outline"
    >
      Sign in
    </Button>
  );
};

export default UserMenu;
