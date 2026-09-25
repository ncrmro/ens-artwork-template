// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// Immutable artwork records. Only the deploying registry can create records.
contract ArtResolver {
    address public immutable registry;
    mapping(bytes32 => bytes) private hashes;
    mapping(bytes32 => string) private metadata;
    constructor() { registry = msg.sender; }
    function publish(bytes32 node, bytes calldata hash, string calldata uri) external {
        require(msg.sender == registry && hashes[node].length == 0, "Immutable record");
        require(hash.length > 4 && hash[0] == 0xe3 && hash[1] == 0x01, "IPFS contenthash required");
        hashes[node] = hash; metadata[node] = uri;
    }
    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == 0x01ffc9a7 || id == 0x9061b923 || id == 0xbc1c58d1 || id == 0x59d1d43c;
    }
    function contenthash(bytes32 node) external view returns (bytes memory) { return hashes[node]; }
    function text(bytes32 node, string calldata key) external view returns (string memory) {
        return keccak256(bytes(key)) == keccak256("artwork.metadata") ? metadata[node] : "";
    }
    function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory) {
        bytes32 node = _namehash(name, 0);
        require(data.length >= 4, "Missing selector");
        bytes4 selector = bytes4(data[:4]);
        if (selector == 0xbc1c58d1) return abi.encode(hashes[node]);
        if (selector == 0x59d1d43c) {
            (, string memory key) = abi.decode(data[4:], (bytes32,string));
            return abi.encode(keccak256(bytes(key)) == keccak256("artwork.metadata") ? metadata[node] : "");
        }
        revert("Unsupported record");
    }
    function _namehash(bytes calldata name, uint256 at) private pure returns (bytes32) {
        require(at < name.length, "Invalid DNS name");
        uint256 n = uint8(name[at]);
        if (n == 0) { require(at + 1 == name.length, "Trailing DNS bytes"); return bytes32(0); }
        require(n <= 63 && at + n + 1 < name.length, "Invalid DNS label");
        return keccak256(abi.encodePacked(_namehash(name, at+n+1), keccak256(name[at+1:at+n+1])));
    }
}
