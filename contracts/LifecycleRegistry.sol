// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {PermissionedRegistry} from "../vendor/ens-v2/src/registry/PermissionedRegistry.sol";
import {IRegistry} from "../vendor/ens-v2/src/registry/interfaces/IRegistry.sol";
import {IRegistryURIRenderer} from "../vendor/ens-v2/src/registry/interfaces/IRegistryURIRenderer.sol";
import {ILabelStore} from "../vendor/ens-v2/src/utils/interfaces/ILabelStore.sol";
import {RegistryRolesLib} from "../vendor/ens-v2/src/registry/libraries/RegistryRolesLib.sol";
import {ERC1155Singleton} from "../vendor/ens-v2/src/erc1155/ERC1155Singleton.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {ArtResolver} from "./ArtResolver.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// An independently deployed ENS namespace beneath a participant's .eth name.
contract ParticipantRegistry is PermissionedRegistry {
    address public immutable participant;
    constructor(ILabelStore store, IRegistry parent, string memory label, address participant_)
        PermissionedRegistry(store, participant_, 0) {
        require(participant_ != address(0), "Participant required");
        participant = participant_; _parentRegistry = parent; _childLabel = label;
    }
    function attach(string calldata label, IRegistry child) external {
        require(msg.sender == participant, "Only participant");
        require(keccak256(bytes(label)) == keccak256("art") || keccak256(bytes(label)) == keccak256("exhibitions"), "Use art or exhibitions");
        (IRegistry parent, string memory childLabel) = child.getParent();
        require(address(parent) == address(this) && keccak256(bytes(childLabel)) == keccak256(bytes(label)), "Wrong child namespace");
        _register(label, participant, child, address(0), 0, type(uint64).max, false);
    }
    function register(string memory,address,IRegistry,address,uint256,uint64) public pure override returns(uint256) { revert("Use attach"); }
}

/// Genesis data is written once. The resolver and ERC1155 metadata share this record.
contract ArtworkRegistry is PermissionedRegistry, IRegistryURIRenderer {
    struct Genesis {
        string label; string title; uint16 year; string medium; string dimensions;
        string imageURI; string manifestURI; bytes contenthash;
        string agreementURI; bytes32 agreementHash; address artist; address royaltyRecipient; uint96 royaltyBps;
    }
    struct Presentation { string publicLocation; string ownerWebsite; address author; uint64 timestamp; }
    // One immutable policy for every work in this version. No owner/admin setter.
    uint64 public constant HOLD_SECONDS = 180 days;
    uint96 public constant ROYALTY_BPS = 500;
    bytes32 public constant TERMS_ID = keccak256("artwork-commons:v1:hold-180-days:resale-royalty-500bps");
    mapping(uint256 => uint64) private transferUnlocks;
    error HoldingPeriodActive(uint64 unlockAt);
    event HoldingPeriodStarted(uint256 indexed tokenId, uint64 unlockAt);
    address public immutable artist;
    bytes32 public immutable namespaceNode;
    ArtResolver public immutable artworkResolver;
    mapping(uint256 => Genesis) private records;
    mapping(uint256 => Presentation) private presentations;
    mapping(uint256 => uint256) private epochs;
    mapping(uint256 => uint64) public issuedAt;
    mapping(uint256 => uint64) private creationDates;
    struct HistoricalInput { bytes32 referenceId; uint8 kind; uint64 occurredAt; string title; string detail; }
    struct HistoricalRecord { uint8 kind; uint64 occurredAt; uint64 recordedAt; address recordedBy; string title; string detail; }
    mapping(uint256 => HistoricalRecord[]) private history;
    mapping(uint256 => mapping(bytes32 => bool)) private historyReferences;
    event HistoricalRecordAdded(uint256 indexed tokenId,uint256 indexed index,uint8 kind,uint64 occurredAt,address indexed recordedBy);
    event CreationDateRecorded(uint256 indexed tokenId,uint64 occurredAt,uint64 recordedAt);
    uint256[] private ids;
    event Issued(uint256 indexed id, address indexed artist, string label, string manifestURI);
    event PresentationUpdated(uint256 indexed id, address indexed owner, string publicLocation, string ownerWebsite);
    constructor(ILabelStore store, IRegistry parent, bytes32 node, address artist_)
        PermissionedRegistry(store, artist_, 0) {
        require(artist_ != address(0), "Artist required");
        artist = artist_; namespaceNode = node; _parentRegistry = parent; _childLabel = "art";
        artworkResolver = new ArtResolver(); _uriRenderer = IRegistryURIRenderer(address(this));
    }
    function key(uint256 id) public pure returns(uint256) { return id & ~uint256(type(uint32).max); }
    function issue(Genesis calldata g) external returns(uint256 tokenId) { return _issue(g,uint64(block.timestamp)); }
    function issueDated(Genesis calldata g,uint64 createdAt) external returns(uint256 tokenId) { return _issue(g,createdAt); }
    function _issue(Genesis calldata g,uint64 createdAt) private returns(uint256 tokenId) {
        require(createdAt>0 && createdAt<=block.timestamp,"Creation date must be past or present");
        require(g.year==_year(createdAt),"Year must match creation date");
        require(msg.sender == artist && g.artist == artist, "Only original artist");
        bytes memory l = bytes(g.label);
        require(l.length > 0 && l.length <= 63, "Invalid label");
        for (uint256 i; i<l.length; ++i) require((l[i]>=0x61 && l[i]<=0x7a)||(l[i]>=0x30 && l[i]<=0x39)||(l[i]==0x2d && i>0 && i+1<l.length), "Lowercase artwork label required");
        require(bytes(g.title).length>0 && bytes(g.title).length<=128 && g.year>0, "Title and year required");
        require(bytes(g.medium).length>0 && bytes(g.medium).length<=256 && bytes(g.dimensions).length<=128, "Medium required");
        require(_ipfs(g.imageURI) && _ipfs(g.manifestURI), "IPFS image and manifest required");
        require((bytes(g.agreementURI).length == 0 && g.agreementHash == bytes32(0)) || (_ipfs(g.agreementURI) && g.agreementHash != bytes32(0)), "Agreement URI and hash required together");
        require(g.royaltyRecipient == artist && g.royaltyBps == ROYALTY_BPS, "Canonical royalty required");
        require(bytes(g.agreementURI).length == 0 && g.agreementHash == bytes32(0), "Canonical terms only");
        uint256 id = uint256(keccak256(l));
        require(bytes(records[key(id)].label).length == 0, "Already issued");
        records[key(id)] = g;
        artworkResolver.publish(keccak256(abi.encodePacked(namespaceNode, bytes32(id))), g.contenthash, g.manifestURI);
        tokenId = _register(g.label, artist, IRegistry(address(0)), address(artworkResolver), RegistryRolesLib.ROLE_CAN_TRANSFER_ADMIN, type(uint64).max, false);
        issuedAt[key(id)]=uint64(block.timestamp); creationDates[key(id)]=createdAt;
        ids.push(id); emit Issued(id, artist, g.label, g.manifestURI);
        emit CreationDateRecorded(id,createdAt,uint64(block.timestamp));
    }
    function createdAt(uint256 id) external view returns(uint64) { return creationDates[key(id)]; }
    function historyCount(uint256 id) external view returns(uint256) { return history[key(id)].length; }
    function historicalRecord(uint256 id,uint256 index) external view returns(HistoricalRecord memory) { return history[key(id)][index]; }
    /// Historical statements are attributed claims, never settlement or ownership updates.
    function recordHistory(uint256 id,HistoricalInput calldata h) external {
        uint256 k=key(id);
        require(msg.sender==artist || msg.sender==getOwner(id),"Only artist or current owner");
        require(creationDates[k]!=0 && h.occurredAt>=creationDates[k] && h.occurredAt<=block.timestamp,"History date outside artwork lifetime");
        require(h.kind>=1 && h.kind<=3,"Use creation, exhibition or purchase");
        require(h.referenceId!=bytes32(0) && !historyReferences[k][h.referenceId],"Duplicate or empty reference");
        require(bytes(h.title).length>0 && bytes(h.title).length<=128 && bytes(h.detail).length<=1024,"Invalid history text");
        historyReferences[k][h.referenceId]=true;
        HistoricalRecord storage r=history[k].push();
        r.kind=h.kind; r.occurredAt=h.occurredAt; r.recordedAt=uint64(block.timestamp); r.recordedBy=msg.sender;
        r.title=h.title; r.detail=h.detail;
        emit HistoricalRecordAdded(id,history[k].length-1,h.kind,h.occurredAt,msg.sender);
    }
    function _year(uint64 timestamp) private pure returns(uint256 year) {
        // Gregorian civil calendar, days since Unix epoch.
        uint256 z=uint256(timestamp)/86400+719468;
        uint256 era=z/146097; uint256 doe=z-era*146097;
        uint256 yoe=(doe-doe/1460+doe/36524-doe/146096)/365;
        year=yoe+era*400;
        uint256 doy=doe-(365*yoe+yoe/4-yoe/100);
        if((5*doy+2)/153>=10) ++year;
    }
    function _ipfs(string memory uri) private pure returns(bool) { bytes memory b=bytes(uri); return b.length>7 && b.length<=256 && bytes7(b)==bytes7("ipfs://"); }
    function register(string memory,address,IRegistry,address,uint256,uint64) public pure override returns(uint256) { revert("Use issue"); }
    function genesis(uint256 id) external view returns(Genesis memory) { return records[key(id)]; }
    function recordCount() external view returns(uint256) { return ids.length; }
    function recordId(uint256 i) external view returns(uint256) { return ids[i]; }
    function ownershipEpoch(uint256 id) external view returns(uint256) { return epochs[key(id)]; }
    function presentation(uint256 id) external view returns(Presentation memory) { return presentations[key(id)]; }
    function setPresentation(uint256 id, string calldata location, string calldata website) external {
        require(getOwner(id) == msg.sender, "Only current owner");
        require(bytes(location).length<=256 && bytes(website).length<=256, "Record too long");
        presentations[key(id)] = Presentation(location, website, msg.sender, uint64(block.timestamp));
        emit PresentationUpdated(id,msg.sender,location,website);
    }
    function resaleAllowedAt(uint256 id) public view returns(uint64) { return transferUnlocks[key(id)]; }
    function saleAllowed(uint256 id) public view returns(bool) {
        return bytes(records[key(id)].label).length != 0 && block.timestamp >= resaleAllowedAt(id);
    }
    // Check before the ERC-1155 receiver callback, including approved operators.
    function _beforeTransfer(uint256 id,uint256 amount) private {
        if(amount == 0) return;
        uint256 k = key(id);
        uint64 unlockAt = transferUnlocks[k];
        if(block.timestamp < unlockAt) revert HoldingPeriodActive(unlockAt);
        ++epochs[k];
        transferUnlocks[k] = uint64(block.timestamp) + HOLD_SECONDS;
        emit HoldingPeriodStarted(id,transferUnlocks[k]);
    }
    function safeTransferFrom(address from,address to,uint256 id,uint256 value,bytes memory data) public override(ERC1155Singleton,IERC1155) {
        _beforeTransfer(id,value);
        super.safeTransferFrom(from,to,id,value,data);
    }
    function safeBatchTransferFrom(address from,address to,uint256[] memory tokenIds,uint256[] memory values,bytes memory data) public override(ERC1155Singleton,IERC1155) {
        require(tokenIds.length==values.length,"Length mismatch");
        for(uint256 i; i<tokenIds.length; ++i) _beforeTransfer(tokenIds[i],values[i]);
        super.safeBatchTransferFrom(from,to,tokenIds,values,data);
    }
    function renderURI(IRegistry registry,uint256 id) external view returns(string memory) { require(address(registry)==address(this),"Wrong registry"); return records[key(id)].manifestURI; }
    function royaltyInfo(uint256 id,uint256 price) external view returns(address,uint256) { Genesis storage g=records[key(id)]; return(g.royaltyRecipient,Math.mulDiv(price,g.royaltyBps,10000)); }
    function supportsInterface(bytes4 id) public view override returns(bool) { return id==0x2a55205a || id==type(IRegistryURIRenderer).interfaceId || super.supportsInterface(id); }
}
