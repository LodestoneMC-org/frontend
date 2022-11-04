import axios from 'axios';
import { InstanceInfo } from 'bindings/InstanceInfo';
import { useConsoleStream } from 'data/ConsoleStream';
import { InstanceContext } from 'data/InstanceContext';
import { useUserAuthorized, useUserInfo } from 'data/UserInfo';
import { useContext, useEffect } from 'react';
import { useRef, useState } from 'react';
import { usePrevious } from 'utils/hooks';

const autoScrollThreshold = 100;

export default function GameConsole() {
  const { selectedInstance: instance } = useContext(InstanceContext);
  if (!instance) throw new Error('No instance selected');
  const uuid = instance.uuid;
  const canAccessConsole = useUserAuthorized(
    'can_access_instance_console',
    uuid
  );
  const { consoleLog, consoleStatus } = useConsoleStream(uuid);
  const [command, setCommand] = useState('');
  const listRef = useRef<HTMLOListElement>(null);
  const isAtBottom = listRef.current
    ? listRef.current.scrollHeight -
        listRef.current.scrollTop -
        listRef.current.clientHeight <
      autoScrollThreshold
    : true;
  const oldIsAtBottom = usePrevious(isAtBottom);

  const scrollToBottom = () => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  };

  // if the user is already at the bottom of the list, scroll to the bottom when new items are added
  // otherwise, don't scroll
  useEffect(() => {
    if (oldIsAtBottom) scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consoleLog]);

  const sendCommand = (command: string) => {
    axios({
      method: 'post',
      url: `/instance/${uuid}/console`,
      data: JSON.stringify(command),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    scrollToBottom();
  };

  let consoleStatusMessage = '';
  switch (consoleStatus) {
    case 'no-permission':
      consoleStatusMessage =
        'You do not have permission to access this console';
      break;
    case 'loading':
      consoleStatusMessage = 'Loading console...';
      break;
    case 'buffered':
      consoleStatusMessage = 'History messages. No live updates';
      break;
    case 'live':
      consoleStatusMessage = 'Console is live';
      break;
    case 'live-no-buffer':
      consoleStatusMessage =
        'Console is live but failed to fetch history. Your internet connection may be unstable';
      break;
    case 'closed':
      consoleStatusMessage = 'Console is closed';
      break;
    case 'error':
      consoleStatusMessage = 'Connection lost or error';
  }

  let consoleInputMessage = '';
  if (!canAccessConsole || consoleStatus === 'no-permission')
    consoleInputMessage = 'You do not have permission to access this console';
  else if (instance.state !== 'Running')
    consoleInputMessage = `Instance is ${instance.state.toLowerCase()}`;
  else if (consoleStatus === 'closed')
    consoleInputMessage = 'Console is closed';

  return (
    <div className="relative flex flex-col w-full h-full border rounded-2xl border-gray-faded/30">
      {consoleStatusMessage && (
        <div className="absolute top-0 right-0 p-4 py-1 font-mono font-light tracking-tight text-gray-500 select-none text-small hover:text-gray-400">
          {consoleStatusMessage}
        </div>
      )}
      <ol
        className="flex h-0 grow flex-col overflow-x-auto overflow-y-auto whitespace-pre-wrap break-words rounded-t-2xl border-b border-gray-faded/30 bg-[#101010] py-3 font-mono text-small font-light tracking-tight text-gray-300"
        ref={listRef}
      >
        {consoleLog.map((line) => (
          <li
            key={line.snowflake_str}
            className="py-[0.125rem] px-4 hover:bg-gray-800"
          >
            {line.message}
          </li>
        ))}
      </ol>
      <div className="font-mono text-small">
        <form
          noValidate
          autoComplete="off"
          onSubmit={(e: React.SyntheticEvent) => {
            e.preventDefault();
            sendCommand(command);
            setCommand('');
          }}
        >
          <input
            className="w-full rounded-b-2xl bg-[#101010] py-3 px-4 text-gray-300 outline-white/50 placeholder:text-gray-500 focus-visible:outline focus-visible:outline-2 disabled:placeholder:text-gray-500"
            placeholder={consoleInputMessage || 'Enter command...'}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            id="command"
            type="text"
            disabled={consoleInputMessage !== ''}
          />
        </form>
      </div>
    </div>
  );
}
