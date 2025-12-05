console.log('script.js file is being parsed'); // TEST LINE

// Twilio Voice SDK 2.x loaded via CDN in index.html
// script.js for Twilio WebRTC Outbound Caller

document.addEventListener('DOMContentLoaded', () => {
    const callButton = document.getElementById('callButton');
    const destinationInput = document.getElementById('destination');
    const statusMessage = document.getElementById('statusMessage');

    let device = null;
    let activeCall = null;

    const SUPABASE_URL = 'https://jfjvrpnvhdcvmzmkyxnu.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmanZycG52aGRjdm16bWt5eG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwMjMyNDQsImV4cCI6MjA2MTU5OTI0NH0.1qL2NXWBPuxz49R9jHLWoZdAz06M8t9SGOGdtlkVcvI';

    statusMessage.textContent = 'Initializing...';

    async function getAccessToken() {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/twilio-voice-token`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch access token');
        }
        
        const data = await response.json();
        console.log('Token response:', data);
        return data.token;
    }

    async function initializeTwilioDevice() {
        try {
            // Check for Twilio Voice SDK 2.x
            if (typeof Twilio === 'undefined') {
                statusMessage.textContent = 'Error: Twilio SDK not loaded. Check console.';
                console.error('Twilio is not defined. SDK might not have loaded.');
                return;
            }

            // SDK 2.x uses Twilio.Device directly as a constructor
            const DeviceClass = Twilio.Device;
            if (!DeviceClass) {
                statusMessage.textContent = 'Error: Twilio.Device not found. Check console.';
                console.error('Twilio.Device is not defined.');
                return;
            }

            console.log('Twilio SDK 2.x found. Fetching access token...');
            statusMessage.textContent = 'Fetching access token...';

            const token = await getAccessToken();
            console.log('Access token received. Initializing device...');

            // Initialize device with SDK 2.x
            device = new DeviceClass(token, {
                logLevel: 1,
                codecPreferences: ['opus', 'pcmu']
            });

            device.on('registered', () => {
                statusMessage.textContent = 'Ready. Enter destination and click call.';
                console.log('Twilio device registered and ready.');
            });

            device.on('error', (error) => {
                const errorMsg = error.message || error.code || 'Unknown error';
                statusMessage.textContent = `Device Error: ${errorMsg}. Check console.`;
                console.error('Twilio device error - code:', error.code);
                console.error('Twilio device error - message:', error.message);
                console.error('Twilio device error - full:', error);
                activeCall = null;
                callButton.textContent = 'Call';
            });

            device.on('tokenWillExpire', async () => {
                console.log('Token will expire soon, refreshing...');
                const newToken = await getAccessToken();
                device.updateToken(newToken);
            });

            // Register the device
            await device.register();
            console.log('Device registration initiated.');

        } catch (error) {
            statusMessage.textContent = `Initialization failed: ${error.message}. Check console.`;
            console.error('Error initializing Twilio Device:', error);
        }
    }

    function attachCallHandlers(call) {
        call.on('accept', () => {
            statusMessage.textContent = 'Call connected!';
            callButton.textContent = 'Hang Up';
            console.log('Call accepted/connected.');
        });

        call.on('disconnect', () => {
            statusMessage.textContent = 'Call ended.';
            activeCall = null;
            callButton.textContent = 'Call';
            console.log('Call disconnected.');
            setTimeout(() => {
                if (!activeCall) {
                    statusMessage.textContent = 'Ready. Enter destination and click call.';
                }
            }, 2000);
        });

        call.on('cancel', () => {
            statusMessage.textContent = 'Call cancelled.';
            activeCall = null;
            callButton.textContent = 'Call';
            console.log('Call cancelled.');
        });

        call.on('reject', () => {
            statusMessage.textContent = 'Call rejected.';
            activeCall = null;
            callButton.textContent = 'Call';
            console.log('Call rejected.');
        });

        call.on('error', (error) => {
            statusMessage.textContent = `Call Error: ${error.message}`;
            console.error('Call error:', error);
            activeCall = null;
            callButton.textContent = 'Call';
        });

        call.on('ringing', (hasEarlyMedia) => {
            statusMessage.textContent = 'Ringing...';
            console.log('Call is ringing. Has early media:', hasEarlyMedia);
        });
    }

    callButton.addEventListener('click', async () => {
        if (activeCall) {
            console.log('Hangup button clicked. Disconnecting call...');
            statusMessage.textContent = 'Hanging up...';
            activeCall.disconnect();
            return;
        }

        const destination = destinationInput.value.trim();
        if (!destination) {
            alert('Please enter a destination phone number.');
            return;
        }

        if (!device) {
            statusMessage.textContent = 'Twilio device not initialized. Please wait or refresh.';
            console.error('Twilio device not ready.');
            return;
        }

        statusMessage.textContent = `Dialing ${destination}...`;
        console.log(`Attempting to call: ${destination}`);
        callButton.textContent = 'Hang Up';

        try {
            // Make outbound call with SDK 2.x
            activeCall = await device.connect({
                params: {
                    To: destination
                }
            });
            
            attachCallHandlers(activeCall);
            console.log('Call initiated:', activeCall);

        } catch (error) {
            statusMessage.textContent = `Failed to initiate call: ${error.message}. Check console.`;
            console.error('Error initiating call:', error);
            activeCall = null;
            callButton.textContent = 'Call';
        }
    });

    initializeTwilioDevice();

});
