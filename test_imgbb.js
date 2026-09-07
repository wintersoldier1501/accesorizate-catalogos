async function testImgbb() {
    const apiKey = '493fdacac64bf23ed3a0977692dfe291';
    
    const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

    const formData = new FormData();
    formData.append('key', apiKey);
    formData.append('image', base64Image);

    try {
        const response = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        console.log("Response:", data);
    } catch (e) {
        console.error("Error:", e);
    }
}

testImgbb();
