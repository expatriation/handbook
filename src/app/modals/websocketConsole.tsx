import { IonText } from '@ionic/react';
import { useContext, useMemo } from 'react';
import { PageShell } from '../components/pageShell';
import { AppContext } from '../utils/appContext';

const WebsocketConsole = ({ onDismiss }: { onDismiss: () => void }) => {
  const { latestSocketResponse } = useContext(AppContext);

  const formattedPayload = useMemo(() => {
    if (!latestSocketResponse?.payload) {
      return latestSocketResponse?.raw ?? 'No websocket responses received yet.';
    }

    return JSON.stringify(latestSocketResponse.payload, null, 2);
  }, [latestSocketResponse]);

  return (
    <PageShell
      onDismissModal={onDismiss}
      renderBody={() => (
        <section className="ion-padding">
          <IonText color="medium">
            <p>
              Latest response captured at:{' '}
              {latestSocketResponse
                ? new Date(latestSocketResponse.receivedAt).toLocaleString()
                : 'N/A'}
            </p>
          </IonText>

          <pre
            style={{
              marginTop: 8,
              maxHeight: '70vh',
              overflow: 'auto',
              padding: 12,
              borderRadius: 8,
              background: 'var(--ion-color-step-100)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {formattedPayload}
          </pre>
        </section>
      )}
    />
  );
};

export default WebsocketConsole;
