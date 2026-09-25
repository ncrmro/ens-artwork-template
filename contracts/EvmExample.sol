// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
/// A small standalone Sepolia example, independent of ENS ownership.
contract EvmExample {
    event MessageSaved(address indexed author,string message);
    mapping(address=>string) public messages;
    function save(string calldata message) external {
        require(bytes(message).length>0 && bytes(message).length<=280,"Use 1-280 bytes");
        messages[msg.sender]=message; emit MessageSaved(msg.sender,message);
    }
}
