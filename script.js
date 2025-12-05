console.log('script.js file is being parsed'); // TEST LINE

// Twilio Voice SDK 2.x loaded via CDN in index.html
// script.js for Twilio WebRTC Outbound Caller

document.addEventListener('DOMContentLoaded', () => {
    const callButton = document.getElementById('callButton');
    const destinationInput = document.getElementById('destination');
    const statusMessage = document.getElementById('statusMessage');
    const connectionStatus = document.getElementById('connectionStatus');

    const callBtnText = callButton.querySelector('.text');
    const callBtnIcon = callButton.querySelector('.icon');

    let device = null;
    let activeCall = null;

    const SUPABASE_URL = 'https://jfjvrpnvhdcvmzmkyxnu.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmanZycG52aGRjdm16bWt5eG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwMjMyNDQsImV4cCI6MjA2MTU5OTI0NH0.1qL2NXWBPuxz49R9jHLWoZdAz06M8t9SGOGdtlkVcvI';

    function updateStatus(message) {
        statusMessage.textContent = message;
    }

    function updateConnectionStatus(status) {
        connectionStatus.className = 'connection-indicator ' + status;
    }

    function setButtonState(state) {
        if (state === 'call') {
            callBtnText.textContent = 'Call';
            callBtnIcon.textContent = '📞';
            callButton.classList.remove('hangup');
        } else if (state === 'hangup') {
            callBtnText.textContent = 'End Call';
            callBtnIcon.textContent = '❌';
            callButton.classList.add('hangup');
        }
    }

    updateStatus('Initializing...');

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
                updateStatus('Error: Twilio SDK not loaded.');
                console.error('Twilio is not defined. SDK might not have loaded.');
                updateConnectionStatus('error');
                return;
            }

            // SDK 2.x uses Twilio.Device directly as a constructor
            const DeviceClass = Twilio.Device;
            if (!DeviceClass) {
                updateStatus('Error: Twilio.Device not found.');
                console.error('Twilio.Device is not defined.');
                updateConnectionStatus('error');
                return;
            }

            console.log('Twilio SDK 2.x found. Fetching access token...');
            updateStatus('Connecting...');

            const token = await getAccessToken();
            console.log('Access token received. Initializing device...');

            // Initialize device with SDK 2.x
            device = new DeviceClass(token, {
                logLevel: 1,
                codecPreferences: ['opus', 'pcmu']
            });

            device.on('registered', () => {
                updateStatus('Ready to call');
                console.log('Twilio device registered and ready.');
                updateConnectionStatus('connected');
            });

            device.on('error', (error) => {
                const errorMsg = error.message || error.code || 'Unknown error';
                updateStatus(`Device Error: ${errorMsg}`);
                console.error('Twilio device error - code:', error.code);
                console.error('Twilio device error - message:', error.message);
                console.error('Twilio device error - full:', error);
                activeCall = null;
                setButtonState('call');
                updateConnectionStatus('error');
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
            updateStatus(`Initialization failed`);
            console.error('Error initializing Twilio Device:', error);
            updateConnectionStatus('error');
        }
    }

    function attachCallHandlers(call) {
        call.on('accept', () => {
            updateStatus('Call connected');
            setButtonState('hangup');
            console.log('Call accepted/connected.');
        });

        call.on('disconnect', () => {
            updateStatus('Call ended');
            activeCall = null;
            setButtonState('call');
            console.log('Call disconnected.');
            setTimeout(() => {
                if (!activeCall) {
                    updateStatus('Ready to call');
                }
            }, 2000);
        });

        call.on('cancel', () => {
            updateStatus('Call cancelled');
            activeCall = null;
            setButtonState('call');
            console.log('Call cancelled.');
        });

        call.on('reject', () => {
            updateStatus('Call rejected');
            activeCall = null;
            setButtonState('call');
            console.log('Call rejected.');
        });

        call.on('error', (error) => {
            updateStatus(`Call Error: ${error.message}`);
            console.error('Call error:', error);
            activeCall = null;
            setButtonState('call');
        });

        call.on('ringing', (hasEarlyMedia) => {
            updateStatus('Ringing...');
            console.log('Call is ringing. Has early media:', hasEarlyMedia);
        });
    }

    callButton.addEventListener('click', async () => {
        if (activeCall) {
            console.log('Hangup button clicked. Disconnecting call...');
            updateStatus('Hanging up...');
            activeCall.disconnect();
            return;
        }

        const destination = destinationInput.value.trim();
        if (!destination) {
            updateStatus('Please enter a number');
            destinationInput.focus();
            return;
        }

        if (!device) {
            updateStatus('Device not ready');
            console.error('Twilio device not ready.');
            return;
        }

        updateStatus(`Dialing ${destination}...`);
        console.log(`Attempting to call: ${destination}`);
        setButtonState('hangup');

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
            updateStatus(`Call failed: ${error.message}`);
            console.error('Error initiating call:', error);
            activeCall = null;
            setButtonState('call');
        }
    });

    // Auto-format phone number input (simple version)
    destinationInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 0 && !value.startsWith('1')) {
             // If user doesn't type country code, we can assume US for this demo, 
             // but let's just let them type freely for now or prepend + if missing.
        }
        // Simple visual feedback or formatting could go here
    });

    initializeTwilioDevice();

});
