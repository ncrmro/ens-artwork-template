// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {PermissionedRegistry} from "../vendor/ens-v2/src/registry/PermissionedRegistry.sol";
import {IRegistry} from "../vendor/ens-v2/src/registry/interfaces/IRegistry.sol";
import {IRegistryURIRenderer} from "../vendor/ens-v2/src/registry/interfaces/IRegistryURIRenderer.sol";
import {ILabelStore} from "../vendor/ens-v2/src/utils/interfaces/ILabelStore.sol";
import {LibLabel} from "../vendor/ens-v2/src/utils/LibLabel.sol";
import {RegistryRolesLib} from "../vendor/ens-v2/src/registry/libraries/RegistryRolesLib.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ArtResolver} from "./ArtResolver.sol";

/// Non-upgradeable artist namespace. No root administrator can mutate published records.
contract ArtRegistry is PermissionedRegistry, ReentrancyGuard, IRegistryURIRenderer {
    struct Artwork { string label; string title; string metadataURI; bytes contenthash; address recipient; uint96 bps; }
    address public immutable artist;
    bytes32 public immutable parentNode;
    ArtResolver public immutable artResolver;
    mapping(uint256 => Artwork) private artworks;
    uint256[] private ids;
    event ArtworkPublished(uint256 indexed labelId, uint256 tokenId, string label);
    constructor(ILabelStore store, IRegistry parent, string memory parentLabel, address artist_)
        PermissionedRegistry(store, artist_, 0) {
        require(artist_ != address(0), "Invalid artist");
        artist = artist_;
        _parentRegistry = parent; _childLabel = parentLabel;
        parentNode = keccak256(abi.encodePacked(keccak256(abi.encodePacked(bytes32(0),keccak256("eth"))),keccak256(bytes(parentLabel))));
        artResolver = new ArtResolver();
        _uriRenderer = IRegistryURIRenderer(address(this));
    }
    function publish(string calldata label, string calldata title, string calldata metadataURI, bytes calldata hash, address recipient, uint96 bps)
        external nonReentrant returns (uint256 tokenId) {
        require(msg.sender == artist, "Only artist");
        bytes memory l = bytes(label);
        require(l.length > 0 && l.length <= 63, "Invalid label");
        for (uint256 i; i<l.length; ++i) require((l[i]>=0x61 && l[i]<=0x7a)||(l[i]>=0x30 && l[i]<=0x39)||(l[i]==0x2d && i>0 && i+1<l.length), "Use lowercase ASCII label");
        require(bytes(title).length>0 && bytes(title).length<=128, "Invalid title");
        bytes memory uriBytes = bytes(metadataURI);
        require(uriBytes.length>7 && uriBytes.length<=256 && bytes7(uriBytes)==bytes7("ipfs://"), "IPFS metadata required");
        require(recipient != address(0) && bps <= 10000, "Invalid royalty");
        uint256 labelId = LibLabel.id(label);
        uint256 key = LibLabel.withVersion(labelId,0);
        require(bytes(artworks[key].label).length == 0, "Artwork exists");
        artworks[key] = Artwork(label,title,metadataURI,hash,recipient,bps);
        artResolver.publish(keccak256(abi.encodePacked(parentNode,bytes32(labelId))),hash,metadataURI);
        tokenId = _register(label,artist,IRegistry(address(0)),address(artResolver),RegistryRolesLib.ROLE_CAN_TRANSFER_ADMIN,type(uint64).max,false);
        ids.push(labelId);
        emit ArtworkPublished(labelId,tokenId,label);
    }
    function register(string memory,address,IRegistry,address,uint256,uint64) public pure override returns(uint256) { revert("Use publish"); }
    function artwork(uint256 anyId) external view returns (Artwork memory) { return artworks[LibLabel.withVersion(anyId,0)]; }
    function artworkCount() external view returns(uint256) { return ids.length; }
    function artworkId(uint256 index) external view returns(uint256) { return ids[index]; }
    function renderURI(IRegistry registry,uint256 tokenId) external view returns(string memory) {
        require(address(registry)==address(this),"Wrong registry"); return artworks[LibLabel.withVersion(tokenId,0)].metadataURI;
    }
    function royaltyInfo(uint256 tokenId,uint256 price) external view returns(address,uint256) {
        Artwork storage a = artworks[LibLabel.withVersion(tokenId,0)];
        return (a.recipient,Math.mulDiv(price,a.bps,10000));
    }
    function supportsInterface(bytes4 id) public view override returns(bool) {
        return id == 0x2a55205a || id == type(IRegistryURIRenderer).interfaceId || super.supportsInterface(id);
    }
}
