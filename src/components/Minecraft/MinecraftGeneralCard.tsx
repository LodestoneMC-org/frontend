import DashboardCard from 'components/DashboardCard';
import Textfield from 'components/Textfield';
import { updateInstance } from 'data/InstanceList';
import { axiosPutSingleValue, axiosWrapper } from 'utils/util';
import { useQueryClient } from '@tanstack/react-query';
import { InstanceInfo } from 'bindings/InstanceInfo';
import { useInstanceManifest } from 'data/InstanceManifest';

export default function MinecraftGeneralCard({
  instance,
}: {
  instance: InstanceInfo;
}) {
  const queryClient = useQueryClient();
  const { data: manifest, isLoading } = useInstanceManifest(instance.uuid);
  const supportedOptions = manifest?.supported_operations
    ? manifest.supported_operations
    : [];
  const currentSettings = manifest?.settings ? manifest.settings : [];

  if (isLoading) {
    // TODO: show an unobtrusive loading screen, reduce UI flicker
    return <div>Loading...</div>;
  }

  console.log(supportedOptions)

  const portField = (
    <Textfield
      label="Port"
      value={instance.port.toString()}
      type="number"
      removeArrows={true}
      disabled={!supportedOptions.includes('SetPort')}
      onSubmit={async (port) => {
        const numPort = parseInt(port);
        await axiosPutSingleValue<void>(
          `/instance/${instance.uuid}/port`,
          numPort
        );
        updateInstance(instance.uuid, queryClient, (oldData) => ({
          ...oldData,
          port: numPort,
        }));
      }}
      validate={async (port) => {
        const numPort = parseInt(port);
        if (isNaN(numPort)) throw new Error('Port must be a number');
        if (numPort < 0 || numPort > 65535)
          throw new Error('Port must be between 0 and 65535');
        const result = await axiosWrapper<boolean>({
          method: 'get',
          url: `/check/port/${numPort}`,
        });
        if (result) throw new Error('Port not available');
      }}
    />
  );

  return (
    <DashboardCard>
      <h1 className="font-bold text-medium"> General Settings </h1>
      <div className="flex flex-row">{portField}</div>
    </DashboardCard>
  );
}
