export const namevalidation = (value)=>{
    const nameRegex = /^[A-Za-z ]{2,50}$/;
    return nameRegex.test(value)
}

export const emailvalidation =(value)=>{
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value)
}

export const passwordvalidation =(value)=>{
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
return passwordRegex.test(value)
}
 export const pincodevalidation = (value) => { 
    const pincodeRegex = /^[1-9][0-9]{5}$/; 
    return pincodeRegex.test(value); };