export type OnlineStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'unavailable';
export function OnlineAvailability({
  status,
  error,
  onBots,
}: {
  status: OnlineStatus;
  error: string;
  onBots: () => void;
}) {
  return (
    <div className="online-availability">
      <output>
        {status === 'unavailable'
          ? error || 'Online rooms are unavailable right now.'
          : status === 'connected'
            ? 'Room server connected. Create a room or join your friends.'
            : status === 'reconnecting'
              ? 'Reconnecting to the room server… A sleeping server can take up to two minutes to start.'
              : 'Connecting to the room server… A sleeping server can take up to two minutes to start.'}
      </output>
      {status === 'unavailable' && (
        <button className="polish-button emphasized" onClick={onBots}>
          Play bot training
        </button>
      )}
    </div>
  );
}
