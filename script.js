console.log('script.js file is being parsed'); // TEST LINE
import { TelnyxRTC } from 'https://cdn.jsdelivr.net/npm/@telnyx/webrtc@2.22.9/+esm';

// script.js for Telnyx WebRTC Outbound Caller

document.addEventListener('DOMContentLoaded', () => {
    const callButton = document.getElementById('callButton');
    const destinationInput = document.getElementById('destination');
    const statusMessage = document.getElementById('statusMessage');
    // remoteAudioElement is not directly used in JS, SDK handles it via client.remoteElement

    let telnyxClient = null;
    let activeCall = null; // This will hold the call object from notifications

    const TELNYX_SIP_USERNAME = 'breesyapp';
    const TELNYX_SIP_PASSWORD = 'BxOQGOYw';
    const TELNYX_CALLER_NAME = 'WebRTC User';
    const TELNYX_CALLER_NUMBER = '+18434591946';

    statusMessage.textContent = 'Initializing...';

    function initializeTelnyxClient() {
        try {
            if (typeof TelnyxRTC === 'undefined') {
                statusMessage.textContent = 'Error: Telnyx SDK (TelnyxRTC) not loaded. Check console.';
                console.error('TelnyxRTC is not defined. SDK might not have loaded from CDN or might be blocked.');
                return;
            }
            console.log('TelnyxRTC SDK found. Initializing client...');
            telnyxClient = new TelnyxRTC({
                login: TELNYX_SIP_USERNAME,
                password: TELNYX_SIP_PASSWORD,
            });
            telnyxClient.remoteElement = 'remoteAudio';

            telnyxClient.on('telnyx.ready', () => {
                statusMessage.textContent = 'Ready. Enter destination and click call.';
                console.log('Telnyx client ready and connected to Telnyx.');
            });

            telnyxClient.on('telnyx.error', (error) => {
                statusMessage.textContent = `Telnyx Client Error: ${error.message}. Check console.`;
                console.error('Telnyx client error:', error);
                activeCall = null; // Reset active call on client error
                callButton.textContent = 'Call';
            });

            telnyxClient.on('telnyx.notification', (notification) => {
                console.log('Telnyx notification:', notification);

                if (notification.type === 'callUpdate' && notification.call) {
                    // Update our reference to the call object
                    activeCall = notification.call;
                    console.log('[DEBUG] callUpdate notification. Active call state:', activeCall.state, activeCall);

                    // Update UI and state based on the call state from the notification
                    switch (activeCall.state) {
                        case 'new':
                            // callButton.textContent = 'Hang Up'; // Already set when newCall is made
                            // statusMessage.textContent = 'Dialing...'; // Already set
                            break;
                        case 'requesting':
                            statusMessage.textContent = 'Calling...';
                            callButton.textContent = 'Hang Up';
                            break;
                        case 'trying':
                            statusMessage.textContent = 'Ringing remote...';
                            callButton.textContent = 'Hang Up';
                            break;
                        case 'ringing': // This is usually for INCOMING calls, but good to see
                            statusMessage.textContent = 'Call is ringing (incoming?)';
                            callButton.textContent = 'Answer'; // Or Hangup if we don't support answer
                            break;
                        case 'active':
                            statusMessage.textContent = 'Call connected!';
                            callButton.textContent = 'Hang Up';
                            break;
                        case 'hangup':
                            statusMessage.textContent = 'Call ended.';
                            if (activeCall && activeCall.id === notification.call.id) {
                                activeCall = null; // Clear our active call reference
                            }
                            callButton.textContent = 'Call';
                            // Small delay to allow user to read 'Call ended' then reset to ready
                            setTimeout(() => {
                                if (!activeCall) { // Only if another call hasn't started
                                    statusMessage.textContent = 'Ready. Enter destination and click call.';
                                }
                            }, 2000);
                            break;
                        case 'destroy':
                            statusMessage.textContent = 'Call destroyed.';
                            if (activeCall && activeCall.id === notification.call.id) {
                                activeCall = null;
                            }
                            callButton.textContent = 'Call';
                            setTimeout(() => {
                                if (!activeCall) {
                                    statusMessage.textContent = 'Ready. Enter destination and click call.';
                                }
                            }, 2000);
                            break;
                        default:
                            statusMessage.textContent = `Call status: ${activeCall.state}`;
                            callButton.textContent = 'Hang Up'; // Assume a call is in progress
                    }
                } else if (notification.type === 'userMediaError') {
                    statusMessage.textContent = 'Microphone access error. Please allow microphone.';
                    console.error('User Media Error (likely microphone access):', notification);
                    activeCall = null; // Reset call if media fails
                    callButton.textContent = 'Call';
                } else if (notification.type === 'event' && notification.data && notification.data.error) {
                     // Handle other potential errors reported via general event notifications
                    console.error('Received Telnyx event error:', notification.data.error);
                    statusMessage.textContent = `Error: ${notification.data.error.message || notification.data.error}`;
                    activeCall = null;
                    callButton.textContent = 'Call';
                }
            });

            console.log('Connecting Telnyx client to Telnyx infrastructure...');
            statusMessage.textContent = 'Connecting to Telnyx...';
            telnyxClient.connect();

        } catch (error) {
            statusMessage.textContent = 'Initialization failed. Check console for errors.';
            console.error('Error initializing Telnyx Client:', error);
        }
    }

    // Removed attachCallEventHandlers function as it's not applicable
    // Removed handleCallState function as its logic is now in the notification handler

    callButton.addEventListener('click', () => {
        if (activeCall) { // If there's an active call object
            console.log('Hangup button clicked. Attempting to hang up call ID:', activeCall.id);
            statusMessage.textContent = 'Hanging up...';
            try {
                activeCall.hangup(); // Use the hangup method on the call object
            } catch (e) {
                console.error('Error trying to hang up:', e);
                activeCall = null; // Clear if hangup fails badly
                callButton.textContent = 'Call';
                statusMessage.textContent = 'Error hanging up. Ready for new call.';
            }
            // Status and button text will be updated by 'hangup' or 'destroy' notification
            return;
        }

        const destination = destinationInput.value.trim();
        if (!destination) {
            alert('Please enter a destination (phone number or SIP URI).');
            return;
        }

        if (!telnyxClient || !telnyxClient.connected) {
            statusMessage.textContent = 'Telnyx client not connected. Please wait or re-initialize.';
            console.error('Telnyx client not ready or not connected. Cannot make call.');
            return;
        }

        statusMessage.textContent = `Dialing ${destination}...`;
        console.log(`Attempting to call: ${destination}`);
        callButton.textContent = 'Hang Up'; // Optimistically set button text

        try {
            // .newCall() initiates the call. We get the call object via notification.
            // The object returned here might not be the fully interactive one.
            telnyxClient.newCall({
                destinationNumber: destination,
                callerName: TELNYX_CALLER_NAME,
                callerNumber: TELNYX_CALLER_NUMBER,
                audio: true,
                video: false
            });
            // Note: We don't assign the direct result of newCall to activeCall here anymore.
            // activeCall is now solely managed by the 'callUpdate' notification.
        } catch (error) {
            statusMessage.textContent = `Failed to initiate call: ${error.message}. Check console.`;
            console.error('Error initiating call with newCall client method:', error);
            activeCall = null; // Ensure activeCall is null if newCall itself throws
            callButton.textContent = 'Call';
        }
    });

    initializeTelnyxClient();

});