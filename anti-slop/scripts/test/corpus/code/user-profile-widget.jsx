import { useEffect, useState } from 'react';

// Here's the updated code you requested
export function ProfileWidget({ userId }) {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    fetchProfile(userId).then((data) => {
      setProfile(data);
    });
  }, [userId]);

  return (
    <div>
      <img src={profile?.avatarUrl} alt="avatar" />
    </div>
  );
}
